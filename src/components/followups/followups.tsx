"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Info, TriangleAlert } from "lucide-react";
import { useTenant } from "@/components/tenant-provider";
import { RECEITA_FOLLOWUP, type TipoEnvio } from "@/lib/envios";
import { listarRegras } from "@/lib/envios-db";
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
import { fetchPainel } from "@/lib/api-painel";

async function getFollowUps(): Promise<FollowUp[]> {
  const res = await fetchPainel("/api/painel/follow-ups");
  if (!res.ok) throw new Error("falha");
  const j = (await res.json()) as { followups: FollowUp[] };
  return j.followups;
}

const TOM_CSS: Record<Tom, { bg: string; fg: string }> = {
  verde: { bg: "var(--mk-ativa-fraca)", fg: "var(--mk-ativa)" },
  azul: { bg: "var(--mk-pausada-fraca)", fg: "var(--mk-pausada)" },
  cinza: { bg: "var(--mk-superficie-2)", fg: "var(--mk-tinta-fraca)" },
  ambar: { bg: "var(--mk-aviso-fraca)", fg: "var(--mk-aviso)" },
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
  const { atual: clinica, agente } = useTenant();
  const { data, isPending, error } = useQuery({
    queryKey: ["follow-ups"],
    queryFn: getFollowUps,
  });

  // As receitas vêm do BANCO, com o ativo/desligado real. Escrever a lista no
  // componente daria uma tela que mostra o que o porteiro `envio_pode` não
  // conhece.
  const regras = useQuery({
    queryKey: ["envios-regras", clinica?.tenant_id ?? null],
    queryFn: () => listarRegras(clinica!.tenant_id),
    enabled: !!clinica,
  });
  const receitas = useMemo(
    () =>
      (regras.data ?? [])
        .map((r) => ({ regra: r, receita: RECEITA_FOLLOWUP[r.tipo as TipoEnvio] }))
        .filter((x) => x.receita !== null),
    [regras.data]
  );

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

  // Mesma anatomia dos cards da Visão geral (ver `.neg-card` no globals.css):
  // rótulo, valor e SUBTEXTO. O subtexto é o que faltava — "0%" sozinho não
  // diz de quantos, e uma taxa sem denominador não é informação.
  const respondentes = metricas.respondidos + metricas.convertidos;
  const CARDS = [
    {
      label: "Enviados",
      valor: String(metricas.enviados),
      apoio: `nos últimos ${periodo} dias`,
      dica: "",
    },
    {
      label: "Taxa de resposta",
      valor: `${metricas.taxaResposta}%`,
      apoio: `${respondentes} de ${metricas.enviados} enviados`,
      dica: "",
    },
    {
      label: "Viraram agendamento",
      valor: `${metricas.taxaConversao}%`,
      apoio: `${metricas.convertidos} de ${metricas.enviados}`,
      dica: "",
    },
    {
      // O único não óbvio, e o único com ⓘ.
      label: "Não enviados",
      valor: String(metricas.vetados),
      apoio: "barrados pelas regras",
      dica: DICA_VETO,
    },
  ];

  const semNenhum = !isPending && !error && todos.length === 0;

  return (
    <div className="page-fade">
      <div className="fu-header">
        <div>
          {/* Um título só: a barra de topo some em /follow-ups (ver
              app-shell.tsx), porque ela repetia "Follow-ups" logo acima. */}
          <h1 className="fu-titulo">Follow-ups</h1>
          <p className="fu-sub">
            {agente} retoma conversas sozinha. Aqui está o resultado de cada
            receita.
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
            <div className="fu-card-valor">{isPending ? "—" : c.valor}</div>
            <div className="fu-card-apoio">{isPending ? " " : c.apoio}</div>
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
          <div style={{ display: "flex", gap: 9, color: "var(--mk-alerta)", fontSize: 13 }}>
            <TriangleAlert size={16} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} />
            Não foi possível carregar os follow-ups.
          </div>
        </div>
      ) : semNenhum ? (
        // ⚠️ Encostado no topo e em duas linhas. O bloco alto e centralizado de
        // antes misturava duas coisas: "não aconteceu nada ainda" e "estes são
        // os tipos que existem". A segunda virou seção própria, abaixo.
        <div className="fu-vazio">
          <p className="fu-vazio-titulo">Nenhum follow-up enviado ainda.</p>
          <p className="fu-vazio-texto">
            Assim que a primeira receita disparar, o resultado aparece aqui.
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

      {/* ── As receitas ────────────────────────────────────────────────────
          Seção própria, alinhada à esquerda, com o estado REAL de cada uma.
          A lista vem de `envios_regras`: escrevê-la aqui daria uma tela que
          mostra receita que o porteiro `envio_pode` não conhece. */}
      <section className="fu-receitas">
        <h2 className="fu-receitas-titulo">Como {agente} retoma</h2>
        {regras.isPending ? (
          <p className="fu-receita-vazia">Carregando…</p>
        ) : receitas.length === 0 ? (
          <p className="fu-receita-vazia">
            Nenhuma receita configurada — veja Configurações → Envios
            automáticos.
          </p>
        ) : (
          <ul className="fu-receita-lista">
            {receitas.map(({ regra, receita }) => (
              <li key={regra.tipo} className="fu-receita">
                <span className="fu-receita-nome">{receita!.nome}</span>
                <span className="fu-receita-gatilho">{receita!.gatilho}</span>
                <span
                  className={`fu-receita-estado${regra.ativo ? " ativo" : ""}`}
                >
                  {regra.ativo ? "Ativo" : "Desligado"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/configuracoes" className="fu-receita-link">
          Configurar envios automáticos
        </Link>
      </section>
    </div>
  );
}
