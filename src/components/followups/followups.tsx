"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Info, Loader2, TriangleAlert, Undo2 } from "lucide-react";
import { getRelativeTime } from "@/lib/format";
import {
  calcularMetricas,
  noPeriodo,
  ordenarRecentes,
  tiposPresentes,
  tipoLabel,
  RESULTADO_LABEL,
  RESULTADO_TOM,
  PERIODOS,
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

export function FollowUps() {
  const router = useRouter();
  const { data, isPending, error } = useQuery({
    queryKey: ["follow-ups"],
    queryFn: getFollowUps,
  });

  const [periodo, setPeriodo] = useState<Periodo>(30);
  const [filtroResultado, setFiltroResultado] = useState<"todos" | FollowUpResultado>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");

  const todos = data ?? [];

  // Métricas: sempre sobre o período (o corte usa o fuso de Brasília).
  const doPeriodo = useMemo(() => noPeriodo(todos, periodo), [todos, periodo]);
  const metricas = useMemo(() => calcularMetricas(doPeriodo), [doPeriodo]);
  const tipos = useMemo(() => tiposPresentes(todos), [todos]);

  // A lista aplica período + os dois filtros, e ordena por mais recente.
  const lista = useMemo(() => {
    let f = doPeriodo;
    if (filtroResultado !== "todos") f = f.filter((x) => x.resultado === filtroResultado);
    if (filtroTipo !== "todos") f = f.filter((x) => x.tipo === filtroTipo);
    return ordenarRecentes(f);
  }, [doPeriodo, filtroResultado, filtroTipo]);

  function abrirConversa(f: FollowUp) {
    if (!f.lead_id) return;
    router.push(`/conversas?lead=${f.lead_id}`);
  }

  const CARDS = [
    { label: "Enviados", valor: metricas.enviados, sufixo: "" as string, dica: "" },
    { label: "Taxa de resposta", valor: metricas.taxaResposta, sufixo: "%", dica: "" },
    { label: "Viraram agendamento", valor: metricas.taxaConversao, sufixo: "%", dica: "" },
    {
      label: "Não enviados",
      valor: metricas.vetados,
      sufixo: "" as string,
      dica: "A IA avaliou e decidiu não insistir — por exemplo, quando a pessoa disse que ia pensar ou a conversa foi para um humano.",
    },
  ];

  return (
    <div className="page-fade">
      <div className="fu-header">
        <div>
          <p className="fu-sub">
            Quando um cliente novo pergunta e some, a Laura retoma a conversa
            sozinha. Aqui está o resultado.
          </p>
        </div>
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

      {/* Cards de métrica */}
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

      {/* Filtros */}
      {!isPending && !error && todos.length > 0 && (
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
          {tipos.length > 1 && (
            <select
              className="fu-select"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="todos">Todos os tipos</option>
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {tipoLabel(t)}
                </option>
              ))}
            </select>
          )}
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
      ) : todos.length === 0 ? (
        <div className="card fu-vazio">
          <Undo2 size={28} strokeWidth={1.3} style={{ color: "var(--vx-accent)", margin: "0 auto 14px" }} />
          <div className="fu-vazio-titulo">Nenhum follow-up ainda</div>
          <p className="fu-vazio-texto">
            Quando um cliente novo perguntar sobre um procedimento e não
            responder, a Laura retoma a conversa sozinha — e o resultado aparece
            aqui. Costuma acontecer algumas vezes por dia.
          </p>
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
            return (
              <button
                key={f.id}
                className="fu-item"
                onClick={() => abrirConversa(f)}
                disabled={!f.lead_id}
              >
                <div className="fu-item-topo">
                  <span className="fu-item-nome">{f.nome || f.telefone || "Cliente"}</span>
                  <span className="fu-item-quando">
                    {vetado ? "avaliado" : getRelativeTime(f.enviado_em)}
                  </span>
                  <span
                    className="fu-badge"
                    style={{ background: tom.bg, color: tom.fg }}
                  >
                    {RESULTADO_LABEL[f.resultado]}
                  </span>
                </div>

                {/* Vetado não tem mensagem: mostramos o contexto e a razão */}
                <p className="fu-item-msg">
                  {vetado
                    ? f.contexto
                      ? `A IA optou por não insistir. ${f.contexto}`
                      : "A IA avaliou a conversa e decidiu não insistir."
                    : f.mensagem}
                </p>

                {tipos.length > 1 && (
                  <span className="fu-item-tipo">{tipoLabel(f.tipo)}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
