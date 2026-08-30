"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { FormularioPublico, PerguntaPublica } from "@/lib/requisitos";

// O formulário que a cliente abre pelo link do WhatsApp.
//
// UMA PERGUNTA POR VEZ, com avanço automático no `sim_nao`. Formulário longo
// numa tela só é onde a pessoa desiste — e ela está no celular, provavelmente
// na rua, provavelmente no sol. Cada tela pede uma decisão e mais nada.
//
// ⚠️ SEM LOGIN. O token na URL é a credencial, e as duas funções são
// `SECURITY DEFINER` liberadas para `anon`. É por isso que esta tela não sabe
// nada de tenant: quem resolve a clínica é o token, dentro do banco.

type Valor = string;

export function FormularioPublico({
  token,
  form,
}: {
  token: string;
  form: FormularioPublico;
}) {
  const perguntas = form.perguntas;
  const [i, setI] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, Valor>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const atual: PerguntaPublica | undefined = perguntas[i];
  const progresso = useMemo(
    () => (perguntas.length ? (i / perguntas.length) * 100 : 0),
    [i, perguntas.length]
  );

  async function enviar(finais: Record<string, Valor>) {
    setEnviando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.rpc("requisito_responder", {
        p_token: token,
        p_respostas: finais,
      });
      if (error) throw error;
      const r = (data ?? [])[0] as { ok?: boolean } | undefined;
      if (!r?.ok) throw new Error("recusado");
      // ⚠️ `requisito_responder` devolve `alertas`, e eles NÃO são exibidos.
      // São informação clínica para a equipe: dizer "você tem 2 alertas"
      // assusta e a cliente não tem contexto para interpretar. A tela final é
      // confirmação e só.
      setEnviado(true);
    } catch {
      setErro("Não conseguimos enviar agora. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  function responder(valor: Valor) {
    if (!atual) return;
    const proximas = { ...respostas, [atual.chave]: valor };
    setRespostas(proximas);
    avancar(proximas);
  }

  function avancar(base: Record<string, Valor> = respostas) {
    if (i + 1 < perguntas.length) setI(i + 1);
    else enviar(base);
  }

  if (enviado) {
    return (
      <div className="rq-fim">
        <span className="rq-fim-marca" aria-hidden="true">
          <Check size={22} strokeWidth={2.5} />
        </span>
        <h2 className="rq-fim-titulo">Recebemos, obrigada.</h2>
        <p className="rq-fim-texto">
          A equipe vai revisar antes do seu horário.
        </p>
      </div>
    );
  }

  if (!atual) {
    return <p className="rq-aviso">Este formulário não tem perguntas.</p>;
  }

  const valor = respostas[atual.chave] ?? "";
  const podeAvancar = !atual.obrigatorio || valor.trim() !== "";

  return (
    <div className="rq-caixa">
      {/* Barra fina, sem "3 de 5": o número transforma o formulário numa
          tarefa com tamanho, e tamanho é o que faz desistir. */}
      <div className="rq-progresso" role="presentation">
        <div className="rq-progresso-fill" style={{ width: `${progresso}%` }} />
      </div>

      <div className="rq-corpo">
        {i > 0 && (
          <button
            type="button"
            className="rq-voltar"
            onClick={() => setI(i - 1)}
            disabled={enviando}
          >
            <ArrowLeft size={15} strokeWidth={2} /> Voltar
          </button>
        )}

        <h2 className="rq-pergunta">{atual.pergunta}</h2>

        {atual.tipo === "sim_nao" ? (
          // Dois botões grandes, lado a lado. Dropdown ou checkbox aqui é
          // teclado abrindo, alvo pequeno e uma decisão a mais.
          <div className="rq-simnao">
            <button
              type="button"
              className={`rq-opcao${valor === "sim" ? " marcada" : ""}`}
              onClick={() => responder("sim")}
              disabled={enviando}
            >
              Sim
            </button>
            <button
              type="button"
              className={`rq-opcao${valor === "nao" ? " marcada" : ""}`}
              onClick={() => responder("nao")}
              disabled={enviando}
            >
              Não
            </button>
          </div>
        ) : (
          <>
            {atual.tipo === "texto" && (
              <textarea
                className="rq-campo"
                rows={3}
                value={valor}
                onChange={(e) =>
                  setRespostas({ ...respostas, [atual.chave]: e.target.value })
                }
                placeholder="Escreva aqui"
              />
            )}
            {atual.tipo === "data" && (
              <input
                type="date"
                className="rq-campo"
                value={valor}
                onChange={(e) =>
                  setRespostas({ ...respostas, [atual.chave]: e.target.value })
                }
              />
            )}
            {atual.tipo === "numero" && (
              <input
                type="number"
                inputMode="numeric"
                className="rq-campo"
                value={valor}
                onChange={(e) =>
                  setRespostas({ ...respostas, [atual.chave]: e.target.value })
                }
              />
            )}
            <button
              type="button"
              className="rq-continuar"
              onClick={() => avancar()}
              disabled={!podeAvancar || enviando}
            >
              {i + 1 < perguntas.length ? "Continuar" : "Enviar"}
            </button>
          </>
        )}

        {/* Só quem não é obrigatório pode pular — e o botão dizer isso é mais
            honesto que deixar a pessoa tentar avançar e descobrir. */}
        {!atual.obrigatorio && atual.tipo === "sim_nao" && (
          <button
            type="button"
            className="rq-pular"
            onClick={() => avancar()}
            disabled={enviando}
          >
            Pular
          </button>
        )}

        {erro && <p className="rq-erro">{erro}</p>}
      </div>
    </div>
  );
}
