"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Modal } from "@/components/modal";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import {
  ABA_DO_CAMPO,
  camposVazios,
  formatarCep,
  formatarDocumento,
  formatarTelefone,
  paraLinha,
  soDigitos,
  validarLead,
  type CamposLead,
  type ErrosLead,
} from "@/lib/lead-form";

// Cadastro manual de lead — a dona cria cliente sem depender da IA.
//
// Em abas porque a ficha completa tem 17 campos, e um formulário único obriga
// a rolar para achar o botão. Só Nome e Telefone são obrigatórios: quem cadastra
// no balcão tem o telefone na mão e o resto vem depois.
//
// O telefone é gravado como dígitos com DDI 55 — a mesma chave que o n8n usa no
// upsert. Guardar formatado faria o cadastro manual virar um SEGUNDO registro
// quando a pessoa mandasse WhatsApp.

const ABAS = [
  { id: "contato", label: "Contato" },
  { id: "dados", label: "Dados pessoais" },
  { id: "endereco", label: "Endereço" },
  { id: "anotacoes", label: "Anotações" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

function Campo({
  label,
  erro,
  children,
  span,
}: {
  label: string;
  erro?: string;
  children: React.ReactNode;
  span?: string;
}) {
  return (
    <div style={span ? { gridColumn: span } : undefined}>
      <label className="lead-label">{label}</label>
      {children}
      {erro && <div className="lead-erro">{erro}</div>}
    </div>
  );
}

export function NewLeadModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [c, setC] = useState<CamposLead>(camposVazios);
  const [aba, setAba] = useState<AbaId>("contato");
  const [erros, setErros] = useState<ErrosLead>({});
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [etiquetaNova, setEtiquetaNova] = useState("");
  const nomeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setC(camposVazios());
    setAba("contato");
    setErros({});
    setEtiquetaNova("");
    // Foco no primeiro campo: quem abre o modal já quer digitar.
    const t = setTimeout(() => nomeRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  const set = <K extends keyof CamposLead>(k: K, v: CamposLead[K]) => {
    setC((p) => ({ ...p, [k]: v }));
    if (erros[k]) setErros((p) => ({ ...p, [k]: undefined }));
  };

  // Quantos campos preenchidos por aba — o ponto na aba diz onde há conteúdo
  // sem obrigar a abrir uma por uma.
  const preenchidos = useMemo(
    () => ({
      contato: [c.telefone, c.email, c.site].filter(Boolean).length,
      dados: [c.documento, c.empresa, c.anuncio_origem, c.nascimento].filter(Boolean).length,
      endereco: [c.cep, c.logradouro, c.numero, c.bairro, c.cidade, c.uf].filter(Boolean).length,
      anotacoes: c.anotacoes.trim() ? 1 : 0,
    }),
    [c]
  );

  /** ViaCEP: preenche o endereço sozinho. Serve CORS (`*`), então pode sair do
   *  navegador. Falha é silenciosa — CEP não achado só significa digitar à mão. */
  async function buscarCep(valor: string) {
    const d = soDigitos(valor);
    if (d.length !== 8) return;
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = (await r.json()) as {
        erro?: boolean | string;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (j.erro) return;
      setC((p) => ({
        ...p,
        // Não sobrescreve o que a pessoa já digitou.
        logradouro: p.logradouro || j.logradouro || "",
        bairro: p.bairro || j.bairro || "",
        cidade: p.cidade || j.localidade || "",
        uf: p.uf || j.uf || "",
      }));
    } catch {
      /* offline ou CEP fora do ar: o endereço fica manual */
    } finally {
      setBuscandoCep(false);
    }
  }

  function addEtiqueta() {
    const v = etiquetaNova.trim();
    if (!v || c.etiquetas.includes(v)) return;
    set("etiquetas", [...c.etiquetas, v]);
    setEtiquetaNova("");
  }

  async function salvar() {
    const e = validarLead(c);
    setErros(e);
    const primeiro = Object.keys(e)[0] as keyof CamposLead | undefined;
    if (primeiro) {
      // Leva para a aba do erro: mostrar "corrija os campos" com o campo
      // escondido em outra aba é o jeito mais rápido de travar alguém.
      const destino = ABA_DO_CAMPO[primeiro];
      if (destino) setAba(destino as AbaId);
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase.from("leads").insert(paraLinha(c));
      if (error) {
        // 23505 = telefone único. É o erro esperado aqui, e merece texto claro.
        if (error.code === "23505") {
          setErros({ telefone: "Já existe um cliente com esse telefone" });
          setAba("contato");
          return;
        }
        // 42703 = coluna não existe: a migration ainda não foi aplicada.
        if (error.code === "42703") {
          showToast(
            "Os campos novos ainda não existem no banco. Rode a migration de cadastro completo.",
            "error"
          );
          return;
        }
        throw error;
      }
      showToast("Cliente cadastrado", "success");
      onCreated();
      onClose();
    } catch (err) {
      showToast("Erro ao salvar: " + (err as Error).message, "error");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={620}>
      <div className="lead-cab">
        <h2 className="lead-titulo">Novo cliente</h2>
        <p className="lead-sub">Nome e telefone bastam — o resto pode vir depois.</p>
      </div>

      <div className="lead-topo">
        <Campo label="Nome" erro={erros.nome}>
          <input
            ref={nomeRef}
            className="lead-input"
            placeholder="Como a cliente se chama"
            value={c.nome}
            onChange={(e) => set("nome", e.target.value)}
          />
        </Campo>

        <Campo label="Etiquetas">
          <div className="lead-chips">
            {c.etiquetas.map((t) => (
              <span key={t} className="lead-chip">
                {t}
                <button
                  type="button"
                  aria-label={`Remover ${t}`}
                  onClick={() => set("etiquetas", c.etiquetas.filter((x) => x !== t))}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            <input
              className="lead-chip-input"
              placeholder={c.etiquetas.length ? "" : "indicação, VIP, alérgica…"}
              value={etiquetaNova}
              onChange={(e) => setEtiquetaNova(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addEtiqueta();
                }
                // Backspace no campo vazio apaga a última — atalho esperado
                // em campo de chips.
                if (e.key === "Backspace" && !etiquetaNova && c.etiquetas.length) {
                  set("etiquetas", c.etiquetas.slice(0, -1));
                }
              }}
              onBlur={addEtiqueta}
            />
          </div>
        </Campo>
      </div>

      <div className="lead-abas" role="tablist">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            className={`lead-aba${aba === a.id ? " ativa" : ""}`}
            onClick={() => setAba(a.id)}
          >
            {a.label}
            {preenchidos[a.id] > 0 && <span className="lead-aba-ponto" />}
          </button>
        ))}
      </div>

      <div className="lead-painel">
        {aba === "contato" && (
          <div className="lead-grade">
            <Campo label="Telefone" erro={erros.telefone} span="1 / -1">
              <input
                className="lead-input"
                inputMode="tel"
                placeholder="(61) 99999-8888"
                value={c.telefone}
                onChange={(e) => set("telefone", e.target.value)}
                onBlur={(e) => set("telefone", formatarTelefone(e.target.value))}
              />
            </Campo>
            <Campo label="E-mail" erro={erros.email} span="1 / -1">
              <input
                className="lead-input"
                inputMode="email"
                placeholder="cliente@email.com"
                value={c.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Campo>
            <Campo label="Site ou Instagram" span="1 / -1">
              <input
                className="lead-input"
                placeholder="instagram.com/cliente"
                value={c.site}
                onChange={(e) => set("site", e.target.value)}
              />
            </Campo>
          </div>
        )}

        {aba === "dados" && (
          <div className="lead-grade">
            <Campo label="CPF ou CNPJ" erro={erros.documento}>
              <input
                className="lead-input"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={c.documento}
                onChange={(e) => set("documento", formatarDocumento(e.target.value))}
              />
            </Campo>
            <Campo label="Nascimento" erro={erros.nascimento}>
              <input
                type="date"
                className="lead-input"
                value={c.nascimento}
                onChange={(e) => set("nascimento", e.target.value)}
              />
            </Campo>
            <Campo label="Empresa" span="1 / -1">
              <input
                className="lead-input"
                placeholder="Se for atendimento corporativo"
                value={c.empresa}
                onChange={(e) => set("empresa", e.target.value)}
              />
            </Campo>
            <Campo label="Como conheceu a clínica" span="1 / -1">
              <input
                className="lead-input"
                placeholder="Indicação, Instagram, passou em frente…"
                value={c.anuncio_origem}
                onChange={(e) => set("anuncio_origem", e.target.value)}
              />
            </Campo>
          </div>
        )}

        {aba === "endereco" && (
          <div className="lead-grade">
            <Campo label="CEP" erro={erros.cep}>
              <div className="lead-cep">
                <input
                  className="lead-input"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={c.cep}
                  onChange={(e) => {
                    const v = formatarCep(e.target.value);
                    set("cep", v);
                    // Busca sozinho ao completar — ninguém quer clicar num
                    // botão "buscar" depois de digitar 8 dígitos.
                    if (soDigitos(v).length === 8) buscarCep(v);
                  }}
                />
                {buscandoCep && <Loader2 size={14} className="lead-spin" />}
              </div>
            </Campo>
            <Campo label="Número">
              <input
                className="lead-input"
                placeholder="123 ou s/n"
                value={c.numero}
                onChange={(e) => set("numero", e.target.value)}
              />
            </Campo>
            <Campo label="Endereço" span="1 / -1">
              <input
                className="lead-input"
                placeholder="Rua, avenida, quadra…"
                value={c.logradouro}
                onChange={(e) => set("logradouro", e.target.value)}
              />
            </Campo>
            <Campo label="Complemento">
              <input
                className="lead-input"
                placeholder="Apto, bloco, sala"
                value={c.complemento}
                onChange={(e) => set("complemento", e.target.value)}
              />
            </Campo>
            <Campo label="Bairro">
              <input
                className="lead-input"
                value={c.bairro}
                onChange={(e) => set("bairro", e.target.value)}
              />
            </Campo>
            <Campo label="Cidade">
              <input
                className="lead-input"
                value={c.cidade}
                onChange={(e) => set("cidade", e.target.value)}
              />
            </Campo>
            <Campo label="UF" erro={erros.uf}>
              <input
                className="lead-input"
                maxLength={2}
                placeholder="DF"
                value={c.uf}
                onChange={(e) => set("uf", e.target.value.toUpperCase())}
              />
            </Campo>
          </div>
        )}

        {aba === "anotacoes" && (
          <Campo label="Anotações internas">
            <textarea
              className="lead-input lead-textarea"
              rows={6}
              placeholder="Preferências, restrições, o que a equipe precisa lembrar…"
              value={c.anotacoes}
              onChange={(e) => set("anotacoes", e.target.value)}
            />
          </Campo>
        )}
      </div>

      <div className="lead-acoes">
        {/* Sem "Cancelar": o X do canto e a tecla Esc já fecham, e dois
            botões no rodapé faziam a ação primária competir com uma saída que
            já existia em dois lugares. */}
        <button
          type="button"
          className="btn-primary"
          onClick={salvar}
          disabled={salvando}
        >
          {salvando ? "Salvando…" : "Cadastrar cliente"}
        </button>
      </div>
    </Modal>
  );
}
