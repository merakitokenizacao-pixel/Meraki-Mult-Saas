"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Megaphone, Sparkles, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/modal";
import { showToast } from "@/lib/toast";
import {
  DIAS_SEMANA,
  descreverProblemas,
  limparTexto,
  previewAgente,
  problemasDoTexto,
  validarPromocao,
  type ErrosPromocao,
  type Promocao,
} from "@/lib/promocao";

const VAZIO = {
  titulo: "",
  descricao: "",
  procedimento: "",
  valor_promocional: "",
  condicao: "",
  dia_semana: "" as string, // "" = todos os dias
  valida_ate: "",
  ativa: true,
  anuncio_ativo: false,
};

export function PromocaoModal({
  aberto,
  promocao,
  promocoes,
  onClose,
  onSalvo,
}: {
  aberto: boolean;
  promocao: Promocao | null; // null = criar
  promocoes: Promocao[];
  onClose: () => void;
  onSalvo: () => void;
}) {
  const editando = Boolean(promocao);
  const [f, setF] = useState(VAZIO);
  const [erros, setErros] = useState<ErrosPromocao>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setErros({});
    setF(
      promocao
        ? {
            titulo: promocao.titulo,
            descricao: promocao.descricao,
            procedimento: promocao.procedimento ?? "",
            valor_promocional: promocao.valor_promocional,
            condicao: promocao.condicao ?? "",
            dia_semana:
              promocao.dia_semana === null ? "" : String(promocao.dia_semana),
            valida_ate: promocao.valida_ate ?? "",
            ativa: promocao.ativa,
            anuncio_ativo: promocao.anuncio_ativo,
          }
        : VAZIO
    );
  }, [aberto, promocao]);

  // Quem já está no anúncio (para avisar antes de criar uma segunda).
  const outraNoAnuncio = useMemo(
    () => promocoes.find((p) => p.anuncio_ativo && p.id !== promocao?.id) ?? null,
    [promocoes, promocao]
  );

  const campos = useMemo(
    () => ({
      titulo: f.titulo,
      descricao: f.descricao,
      procedimento: f.procedimento.trim() || null,
      valor_promocional: f.valor_promocional,
      condicao: f.condicao.trim() || null,
      dia_semana: f.dia_semana === "" ? null : Number(f.dia_semana),
      valida_ate: f.valida_ate || null,
      ativa: f.ativa,
      anuncio_ativo: f.anuncio_ativo,
    }),
    [f]
  );

  const preview = useMemo(() => previewAgente(campos), [campos]);

  /**
   * Limpa travessão e emoji AO SAIR do campo, avisando o que mudou. Colar do
   * Instagram/Canva quase sempre traz os dois; obrigar a dona a caçar o
   * caractere seria cruel — melhor corrigir e contar o que foi feito.
   */
  function limparAoSair(campo: keyof typeof VAZIO) {
    const valor = f[campo] as string;
    if (!valor) return;
    const problemas = problemasDoTexto(valor);
    if (problemas.length === 0) return;
    const limpo = limparTexto(valor);
    setF((p) => ({ ...p, [campo]: limpo }));
    setErros((e) => ({ ...e, [campo]: undefined }));
    showToast(`Tirei ${descreverProblemas(problemas)} — a Laura não usa.`, "info");
  }

  async function salvar() {
    const errosValidacao = validarPromocao(campos);
    if (Object.keys(errosValidacao).length > 0) {
      setErros(errosValidacao);
      return;
    }
    setErros({});
    setSalvando(true);

    const url = editando
      ? `/api/painel/promocoes/${promocao!.id}`
      : "/api/painel/promocoes";
    const res = await fetch(url, {
      method: editando ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campos),
    });
    setSalvando(false);

    if (!res.ok) {
      if (res.status === 400) {
        const j = (await res.json()) as { erros?: ErrosPromocao };
        setErros(j.erros ?? {});
        return;
      }
      showToast("Não foi possível salvar.", "error");
      return;
    }

    showToast(
      f.ativa
        ? "Salvo — a Laura já vai oferecer na próxima conversa"
        : "Salvo (fora do ar)",
      "success"
    );
    onSalvo();
    onClose();
  }

  if (!aberto) return null;

  return (
    <Modal open onClose={onClose} width={560}>
      <div className="promo-modal-titulo">
        {editando ? "Editar promoção" : "Nova promoção"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label className="form-label">
            Nome da promoção
            <span className="form-dica">é assim que a Laura vai chamar ela</span>
          </label>
          <input
            className="form-input"
            value={f.titulo}
            autoFocus
            onChange={(e) => setF((p) => ({ ...p, titulo: e.target.value }))}
            onBlur={() => limparAoSair("titulo")}
            placeholder="Combo Laser Day 24/07"
          />
          {erros.titulo && <p className="form-erro">{erros.titulo}</p>}
        </div>

        <div>
          <label className="form-label">O que inclui</label>
          <textarea
            className="form-input"
            rows={2}
            value={f.descricao}
            onChange={(e) => setF((p) => ({ ...p, descricao: e.target.value }))}
            onBlur={() => limparAoSair("descricao")}
            placeholder="Axila + virilha na mesma sessão"
            style={{ resize: "vertical", minHeight: 60 }}
          />
          {erros.descricao && <p className="form-erro">{erros.descricao}</p>}
        </div>

        <div className="promo-grid-2">
          <div>
            <label className="form-label">Valor</label>
            <input
              className="form-input"
              value={f.valor_promocional}
              onChange={(e) =>
                setF((p) => ({ ...p, valor_promocional: e.target.value }))
              }
              onBlur={() => limparAoSair("valor_promocional")}
              placeholder="R$ 180,00 no Pix"
            />
            {erros.valor_promocional && (
              <p className="form-erro">{erros.valor_promocional}</p>
            )}
          </div>
          <div>
            <label className="form-label">
              Procedimento <span className="form-dica">opcional</span>
            </label>
            <input
              className="form-input"
              value={f.procedimento}
              onChange={(e) =>
                setF((p) => ({ ...p, procedimento: e.target.value }))
              }
              placeholder="Depilação a laser"
            />
          </div>
        </div>

        <div>
          <label className="form-label">
            Condições <span className="form-dica">opcional</span>
          </label>
          <input
            className="form-input"
            value={f.condicao}
            onChange={(e) => setF((p) => ({ ...p, condicao: e.target.value }))}
            onBlur={() => limparAoSair("condicao")}
            placeholder="até 3 combos por cliente"
          />
          {erros.condicao && <p className="form-erro">{erros.condicao}</p>}
        </div>

        <div className="promo-grid-2">
          <div>
            <label className="form-label">Quando vale</label>
            <select
              className="form-input"
              value={f.dia_semana}
              onChange={(e) =>
                setF((p) => ({ ...p, dia_semana: e.target.value }))
              }
            >
              <option value="">Todos os dias</option>
              {DIAS_SEMANA.map((d, i) => (
                <option key={d} value={i}>
                  Só {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">
              Válida até <span className="form-dica">opcional</span>
            </label>
            <input
              type="date"
              className="form-input"
              value={f.valida_ate}
              onChange={(e) =>
                setF((p) => ({ ...p, valida_ate: e.target.value }))
              }
            />
            {erros.valida_ate && <p className="form-erro">{erros.valida_ate}</p>}
            {f.valida_ate && (
              <p className="form-dica" style={{ marginTop: 5, display: "block" }}>
                Depois dessa data ela some sozinha das conversas.
              </p>
            )}
          </div>
        </div>

        {/* Pré-visualização: a melhor defesa contra texto ruim */}
        <div className="promo-preview">
          <div className="promo-preview-cab">
            <Sparkles size={12} strokeWidth={2} />
            COMO A LAURA VAI FALAR
          </div>
          <p className="promo-preview-texto">
            {preview.trim() || "Preencha os campos para ver a prévia."}
          </p>
        </div>

        {/* Interruptores */}
        <label className="promo-switch">
          <input
            type="checkbox"
            checked={f.ativa}
            onChange={(e) => setF((p) => ({ ...p, ativa: e.target.checked }))}
          />
          <span>
            <strong>Ativa</strong>
            <span className="promo-switch-dica">
              {f.ativa
                ? "a Laura vai oferecer nas conversas"
                : "fica guardada, sem ser oferecida"}
            </span>
          </span>
        </label>

        <label className="promo-switch">
          <input
            type="checkbox"
            checked={f.anuncio_ativo}
            onChange={(e) =>
              setF((p) => ({ ...p, anuncio_ativo: e.target.checked }))
            }
          />
          <span>
            <strong>É a promoção do anúncio</strong>
            <span className="promo-switch-dica">
              marque só a promoção para a qual o anúncio do Instagram/Facebook
              está apontando
            </span>
          </span>
        </label>

        {/* Aviso de conflito: duas no anúncio confundem o agente */}
        {f.anuncio_ativo && outraNoAnuncio && (
          <div className="promo-aviso">
            <Megaphone size={15} strokeWidth={1.9} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              <strong>“{outraNoAnuncio.titulo}”</strong> já está marcada como a
              do anúncio. Ao salvar, ela será desmarcada automaticamente — só
              uma pode estar por vez.
            </span>
          </div>
        )}

        {f.ativa && (
          <p className="promo-nota-live">
            <TriangleAlert size={12} strokeWidth={2} /> Ao salvar, isso passa a
            ser oferecido aos clientes na próxima mensagem.
          </p>
        )}

        <button
          className="btn-primary"
          onClick={salvar}
          disabled={salvando}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}
        >
          {salvando ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Check size={15} strokeWidth={2} />
          )}
          {editando ? "Salvar alterações" : "Criar promoção"}
        </button>
      </div>
    </Modal>
  );
}
