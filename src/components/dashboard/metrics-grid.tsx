import { filterByDate } from "@/lib/date";
import { leadStatusDisplay } from "@/lib/status";
import type { Lead, Agendamento } from "@/types/db";

// Replica renderDashboardMetrics: 4 KPIs reagindo ao período selecionado.
export function MetricsGrid({
  leads,
  agendamentos,
  period,
}: {
  leads: Lead[];
  agendamentos: Agendamento[];
  period: string;
}) {
  const filtered = filterByDate(leads, "criado_em", period);
  const total = filtered.length;
  // Taxa de conversão = leads que viraram CLIENTE (novo modelo de ciclo de
  // vida). Usa o mapeamento único (status.ts), então `cliente` e o legado
  // `convertido` contam juntos. "agendado" NÃO é mais conversão (virou estado
  // transitório; "tem horário" é derivado de agendamentos). Ver CLAUDE.md.
  const convertidos = filtered.filter(
    (l) => leadStatusDisplay(l.status).variant === "cliente"
  ).length;
  const taxa = total > 0 ? Math.round((convertidos / total) * 100) : 0;

  // "Consultas agendadas" e "Receita estimada" usam o MESMO conjunto:
  // agendamentos do período por criado_em (quando foi MARCADA), sem cancelados.
  const agendsPeriodo =
    period === "tudo"
      ? agendamentos
      : filterByDate(agendamentos, "criado_em", period);
  const naoCancelados = agendsPeriodo.filter((a) => a.status !== "cancelado");
  const consultasAgendadas = naoCancelados.length;
  const receita = naoCancelados
    .filter((a) => a.valor)
    .reduce((sum, a) => sum + parseFloat(String(a.valor ?? 0)), 0);
  const receitaFmt =
    receita > 0
      ? receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "R$ 0,00";
  const receitaSize = receita >= 10000 ? "28px" : receita >= 1000 ? "34px" : "44px";

  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <div className="metric-label">Clientes captados</div>
        <div className="metric-value">{total}</div>
        <div className="metric-divider" />
        <div className="metric-sub">via WhatsApp</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Consultas agendadas</div>
        <div className="metric-value" style={{ color: "var(--vx-green)" }}>
          {consultasAgendadas}
        </div>
        <div className="metric-divider" />
        <div className="metric-sub up">clientes confirmados</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Taxa de conversão</div>
        <div className="metric-value" style={{ color: "var(--vx-amber)" }}>
          {taxa}
          <span style={{ fontSize: "24px", opacity: 0.6 }}>%</span>
        </div>
        <div className="metric-divider" />
        <div className="metric-sub">do total de clientes</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Receita estimada</div>
        <div
          className="metric-value"
          style={{ color: "var(--vx-accent)", fontSize: receitaSize }}
        >
          {receitaFmt}
        </div>
        <div className="metric-divider" />
        <div className="metric-sub up">em agendamentos</div>
      </div>
    </div>
  );
}
