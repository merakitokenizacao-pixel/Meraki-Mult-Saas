"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Info, TriangleAlert, Undo2 } from "lucide-react";
import { getRelativeTime } from "@/lib/format";
import {
  calcularMetricas,
  metricasPorTipo,
  noPeriodo,
  ordenarRecentes,
  referenciaLabel,
  tipoLabel,
  PERIODOS,
  RESULTADO_LABEL,
  RESULTADO_TOM,
  TIPOS,
  type FollowUp,
  type FollowUpResultado,
  type Periodo,
  type Tom,
} from "@/lib/followup";

async function getFollowUps(): Promise<FollowUp[]> {
  const res = await fetch("/api/painel/follow-ups");
  if (!res.ok) throw new Error("falha");
  const j = (await res.json()) as { followups: FollowUp[] };
  return j.followups;
}

const TOM_CSS: Record<Tom, { bg: string; fg: string }> = {
  verde: { bg: "var(--vx-green-bg)", fg: "var(--vx-green)" },
  azul: { bg: "var(--vx-blue-bg)", fg: "var(--vx-blue)" },
  cinza: { bg: "var(--vx-surface3)", fg: "var(--vx-muted)" },
  ambar: { bg: "var(--vx-amber-bg)", fg: "var(--vx-amber)" },
};

const RESULTADOS: FollowUpResultado[] = [
  "convertido",
  "respondido",
  "sem_resposta",
  "vetado",
];

const DICA_VETO =
  "A IA avaliou e decidiu não insistir — por exemplo, quando a pessoa disse que ia pensar ou a conversa foi para um humano.";

export function FollowUps() {
  const router = useRouter();
  const { data, isPending, error } = useQuery({
    queryKey: ["follow-ups"],
    queryFn: getFollowUps,
  });

  const [periodo, setPeriodo] = useState<Periodo>(30);
  const [filtroResultado, setFiltroResultado] = useState<
    "todos" | FollowUpResultado
  >("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");

  const todos = data ?? [];

  // Tudo respeita o período (o corte usa o fuso de Brasília).
  const doPeriodo = useMemo(() => noPeriodo(todos, periodo), [todos, periodo]);
  const metricas = useMemo(() => calcularMetricas(doPeriodo), [doPeriodo]);
  const porTipo = useMemo(() => metricasPorTipo(doPeriodo), [doPeriodo]);

  const lista = useMemo(() => {
    let f = doPeriodo;
    if (filtroResultado !== "todos")
      f = f.filter((x) => x.resultado === filtroResultado);
    if (filtroTipo !== "todos") f = f.filter((x) => x.tipo === filtroTipo);
    return ordenarRecentes(f);
  }, [doPeriodo, filtroResultado, filtroTipo]);

  function abrirConversa(f: FollowUp) {
    if (!f.lead_id) return;
    router.push(`/conversas?lead=${f.lead_id}`);
  }

  const CARDS = [
    { label: "Enviados", valor: metricas.enviados, sufixo: "", dica: "" },
    { label: "Taxa de resposta", valor: metricas.taxaResposta, sufixo: "%", dica: "" },
    { label: "Viraram agendamento", valor: metricas.taxaConversao, sufixo: "%", dica: "" },
    { label: "Não enviados", valor: metricas.vetados, sufixo: "", dica: DICA_VETO },
  ];

  const semNenhum = !isPending && !error && todos.length === 0;

  return (
    <div className="page-fade">
      <div className="fu-header">
        <p className="fu-sub">
          A Laura retoma conversas sozinha em quatro situações. Aqui está o
          resultado de cada uma.
        </p>
        <div className="fu-periodo">
          {PERIODOS.map((d) => (
            <button
              key={d}
              className={`fu-periodo-btn${periodo === d ? " ativo" : ""}`}
              onClick={() => setPeriodo(d)}
            >
              {d} dias
            </button>
          ))}
        </div>
      </div>

      {/* Métricas gerais do período */}
      <div className="fu-cards">
        {CARDS.map((c) => (
          <div key={c.label} className="fu-card">
            <div className="fu-card-label">
              {c.label}
              {c.dica && (
                <span className="fu-tip" tabIndex={0}>
                  <Info size={12} strokeWidth={2} />
                  <span className="fu-tip-bolha">{c.dica}</span>
                </span>
              )}
            </div>
            <div className="fu-card-valor">
              {isPending ? "—" : c.valor}
              {!isPending && c.sufixo}
            </div>
          </div>
        ))}
      </div>

      {/* ── Comparativo por tipo ──────────────────────────────────────────
          A entrega que responde "qual follow-up vale a pena manter". Some
          quando não há NENHUM registro: uma tabela de traços não ensina nada,
          e o estado vazio abaixo explica melhor os quatro tipos. */}
      {!isPending && !error && !semNenhum && (
        <div className="card fu-tabela-card">
          <div className="fu-tabela-titulo">Desempenho por tipo</div>
          <div className="fu-tabela-wrap">
            <table className="fu-tabela">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Enviados</th>
                  <th>Responderam</th>
                  <th>Agendaram</th>
                  <th>
                    Não enviados
                    <span className="fu-tip" tabIndex={0}>
                      <Info size={11} strokeWidth={2} />
                      <span className="fu-tip-bolha">{DICA_VETO}</span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {porTipo.map((l) => {
                  const m = l.metricas;
                  const respondentes = m.respondidos + m.convertidos;
                  // Sem envio no período não existe taxa — traço, não 0%.
                  const pct = (n: number) =>
                    m.enviados > 0 ? `${Math.round((n / m.enviados) * 100)}%` : "—";
                  return (
                    <tr key={l.tipo} className={l.vazio ? "vazio" : undefined}>
                      <td>
                        <span className="fu-tabela-tipo">
                          {l.label}
                          {l.gatilho && (
                            <span className="fu-tip" tabIndex={0}>
                              <Info size={11} strokeWidth={2} />
                              <span className="fu-tip-bolha">{l.gatilho}</span>
                            </span>
                          )}
                        </span>
                      </td>
                      {l.vazio ? (
                        <>
                          <td className="fu-td-vazio" colSpan={4}>
                            nenhum no período
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <b>{m.enviados}</b>
                          </td>
                          <td>
                            <b>{respondentes}</b>
                            <span className="fu-pct">{pct(respondentes)}</span>
                          </td>
                          <td>
                            <b>{m.convertidos}</b>
                            <span className="fu-pct">{pct(m.convertidos)}</span>
                          </td>
                          {/* Veto sem porcentagem de propósito: não é taxa de
                              falha, e mostrar "%" ao lado sugeriria que sim. */}
                          <td>
                            <b>{m.vetados}</b>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filtros */}
      {!isPending && !error && !semNenhum && (
        <div className="fu-filtros">
          <div className="fu-chips">
            <button
              className={`fu-chip${filtroResultado === "todos" ? " ativo" : ""}`}
              onClick={() => setFiltroResultado("todos")}
            >
              Todos
            </button>
            {RESULTADOS.map((r) => (
              <button
                key={r}
                className={`fu-chip${filtroResultado === r ? " ativo" : ""}`}
                onClick={() => setFiltroResultado(r)}
              >
                {RESULTADO_LABEL[r]}
              </button>
            ))}
          </div>
          {/* Lista FIXA dos quatro: filtrar por um tipo que não disparou no
              período é uma pergunta legítima ("o Laser Day rodou?"). */}
          <select
            className="fu-select"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            aria-label="Filtrar por tipo"
          >
            <option value="todos">Todos os tipos</option>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Lista */}
      {isPending ? (
        <div className="loading">
          <div className="spinner" /> Carregando...
        </div>
      ) : error ? (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 9, color: "var(--vx-red)", fontSize: 13 }}>
            <TriangleAlert size={16} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} />
            Não foi possível carregar os follow-ups.
          </div>
        </div>
      ) : semNenhum ? (
        // Estado vazio EDUCATIVO: a tabela vai demorar a encher (dois dos tipos
        // disparam raramente), então o vazio aproveita para explicar o que a
        // Laura faz sozinha — é o que faz a dona confiar antes de ver número.
        <div className="card fu-vazio">
          <Undo2
            size={28}
            strokeWidth={1.3}
            style={{ color: "var(--vx-accent)", margin: "0 auto 14px" }}
          />
          <div className="fu-vazio-titulo">Nenhum follow-up ainda</div>
          <p className="fu-vazio-texto">
            A Laura retoma a conversa sozinha nestas quatro situações. Assim que
            a primeira acontecer, o resultado aparece aqui.
          </p>
          <ul className="fu-vazio-tipos">
            {TIPOS.map((t) => (
              <li key={t.valor}>
                <strong>{t.label}</strong>
                <span>{t.gatilho}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : lista.length === 0 ? (
        <div className="card fu-vazio">
          <p className="fu-vazio-texto" style={{ margin: 0 }}>
            Nenhum follow-up com esse filtro no período.
          </p>
        </div>
      ) : (
        <div className="fu-lista">
          {lista.map((f) => {
            const tom = TOM_CSS[RESULTADO_TOM[f.resultado]];
            const vetado = f.resultado === "vetado";
            const ref = referenciaLabel(f.tipo, f.referencia);
            return (
              <button
                key={f.id}
                className="fu-item"
                onClick={() => abrirConversa(f)}
                disabled={!f.lead_id}
              >
                <div className="fu-item-topo">
                  <span className="fu-item-nome">
                    {f.nome || f.telefone || "Cliente"}
                  </span>
                  <span className="fu-item-quando">
                    {vetado ? "avaliado" : getRelativeTime(f.enviado_em)}
                  </span>
                  <span className="fu-badge" style={{ background: tom.bg, color: tom.fg }}>
                    {RESULTADO_LABEL[f.resultado]}
                  </span>
                </div>

                <p className="fu-item-msg">
                  {vetado
                    ? f.contexto
                      ? `A IA optou por não insistir. ${f.contexto}`
                      : "A IA avaliou a conversa e decidiu não insistir."
                    : f.mensagem}
                </p>

                {/* O tipo é neutro de propósito: colorido competiria com o
                    badge de resultado, que é o que importa ler primeiro. */}
                <div className="fu-item-rodape">
                  <span className="fu-item-tipo">{tipoLabel(f.tipo)}</span>
                  {ref && <span className="fu-item-ref">{ref}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
