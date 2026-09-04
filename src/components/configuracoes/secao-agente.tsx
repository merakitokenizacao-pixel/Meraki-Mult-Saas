"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PauseCircle, Smartphone } from "lucide-react";
import { getRelativeTime } from "@/lib/format";
import { fetchPainel } from "@/lib/api-painel";

// Saúde da agente.
//
// O que esta tela mostra é DERIVADO do que a agente deixa no banco — não é
// configuração dela. Horário de atendimento, tom e prompt vivem no n8n, fora
// deste repositório, e não existe tabela aqui para guardá-los; construir
// campos que não persistem seria pior que não ter a tela.
//
// O que dá para responder com dado real é a pergunta que importa no dia a dia:
// "ela está trabalhando agora?".

interface Dados {
  ultimaRespostaAgente: string | null;
  ultimaMensagemCliente: string | null;
  pausados: number;
  totalLeads: number;
  porQuem: { quem: string; qtd: number }[];
}

const MIN = 60_000;

export function SecaoAgente() {
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    const puxar = async () => {
      try {
        const r = await fetchPainel("/api/painel/agente", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const j = await r.json();
        if (vivo) {
          setD(j);
          setErro(false);
        }
      } catch {
        if (vivo) setErro(true);
      }
    };
    puxar();
    const t = setInterval(puxar, MIN);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  // "Está atendendo" não é um campo, é uma comparação: a última coisa que a
  // agente escreveu veio DEPOIS da última coisa que uma cliente escreveu?
  // Se sim, ela está em dia. Se uma cliente falou e ela não respondeu há mais
  // de 10 minutos, alguma coisa travou — e isso é justamente o que hoje só se
  // descobre quando a cliente reclama.
  const atrasada = (() => {
    if (!d?.ultimaMensagemCliente) return false;
    const cliente = new Date(d.ultimaMensagemCliente).getTime();
    const agente = d.ultimaRespostaAgente
      ? new Date(d.ultimaRespostaAgente).getTime()
      : 0;
    return agente < cliente && Date.now() - cliente > 10 * MIN;
  })();

  const pct =
    d && d.totalLeads > 0 ? Math.round((d.pausados / d.totalLeads) * 100) : 0;

  return (
    <>
      <div className="config-card">
        <div className="conexao-topo">
          <span className={`agente-dot${atrasada ? " alerta" : ""}`} />
          <div>
            <div className="conexao-titulo">
              {erro
                ? "Não foi possível checar"
                : !d
                  ? "Checando…"
                  : atrasada
                    ? "Uma cliente está esperando"
                    : "Atendendo"}
            </div>
            <div className="conexao-sub">
              {d?.ultimaRespostaAgente
                ? `Última resposta ${getRelativeTime(d.ultimaRespostaAgente)}`
                : "Sem respostas registradas"}
            </div>
          </div>
        </div>

        {d && (
          <p className="conexao-nota">
            {atrasada ? (
              <>
                A última mensagem de cliente chegou{" "}
                {getRelativeTime(d.ultimaMensagemCliente!)} e ainda não foi
                respondida. Vale conferir a <strong>Conexão</strong> — quando o
                WhatsApp cai, a agente fica muda sem nenhum erro aparecer.
              </>
            ) : (
              <>
                A última mensagem de cliente chegou{" "}
                {getRelativeTime(d.ultimaMensagemCliente ?? "")} e já foi
                respondida.
              </>
            )}
          </p>
        )}

      </div>

      <div className="config-card">
        <div className="conexao-topo">
          <PauseCircle size={18} strokeWidth={1.6} />
          <div>
            <div className="conexao-titulo">IA pausada</div>
            <div className="conexao-sub">
              Conversas em que a agente está calada e alguém precisa responder à
              mão
            </div>
          </div>
          <div className="conexao-acoes">
            <span className="agente-numero">{d ? d.pausados : "—"}</span>
          </div>
        </div>

        {d && d.pausados > 0 && (
          <>
            <p className="conexao-nota">
              <strong>
                {d.pausados} de {d.totalLeads}
              </strong>{" "}
              conversas ({pct}%). A pausa é por conversa e não expira sozinha —
              quem foi pausado há meses continua pausado.
            </p>
            <ul className="agente-quem">
              {d.porQuem.map((p) => (
                <li key={p.quem}>
                  <span>{p.quem}</span>
                  <span className="agente-quem-qtd">{p.qtd}</span>
                </li>
              ))}
            </ul>
            <Link href="/conversas" className="btn-ghost">
              Ver nas Conversas
            </Link>
          </>
        )}
        {d && d.pausados === 0 && (
          <p className="conexao-nota">
            Nenhuma conversa pausada — a agente responde todas.
          </p>
        )}
      </div>

      <div className="config-card">
        <div className="conexao-topo">
          <Smartphone size={18} strokeWidth={1.6} />
          <div>
            <div className="conexao-titulo">O WhatsApp por baixo</div>
            <div className="conexao-sub">
              A agente depende dele: se o número cai, ela para sem avisar
            </div>
          </div>
        </div>
        <p className="conexao-nota">
          O estado da conexão e o QR para reparear ficam em{" "}
          <strong>Conexão</strong>, aqui ao lado.
        </p>
      </div>
    </>
  );
}
