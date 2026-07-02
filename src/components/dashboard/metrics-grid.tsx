import { filterByDate } from "@/lib/date";
import type { Agendamento, Lead } from "@/types/db";

// KPIs da Visão geral (todos absolutos — não dependem de filtro de período):
// - Total de pacientes: nº de leads.
// - Novos este mês: leads com criado_em no mês corrente.
// - Ativos: leads com >=1 agendamento 'realizado' cujo data_agendamento está nos últimos 90 dias.
// - Inativos: total - ativos (ativos + inativos = total).
// - Taxa de retorno: leads com 2+ realizados / leads com 1+ realizado (0% se denom=0), 1 casa decimal.
export function MetricsGrid({
  leads,
  agendamentos,
}: {
  leads: Lead[];
  agendamentos: Agendamento[];
}) {
  const total = leads.length;
  const novosMes = filterByDate(leads, "criado_em", "mes").length;

  const realizados = agendamentos.filter((a) => a.status === "realizado");

  // Ativos: distinct lead_id com realizado nos últimos 90 dias.
  const limite90 = Date.now() - 90 * 86400000;
  const ativosSet = new Set(
    realizados
      .filter(
        (a) => a.data_agendamento && new Date(a.data_agendamento).getTime() >= limite90
      )
      .map((a) => a.lead_id)
  );
  const ativos = ativosSet.size;
  const inativos = total - ativos;

  // Taxa de retorno: (leads com 2+ realizados) / (leads com 1+ realizado) * 100.
  const realizadosPorLead = new Map<string, number>();
  for (const a of realizados) {
    realizadosPorLead.set(a.lead_id, (realizadosPorLead.get(a.lead_id) ?? 0) + 1);
  }
  const com1mais = realizadosPorLead.size;
  let com2mais = 0;
  for (const c of realizadosPorLead.values()) if (c >= 2) com2mais++;
  const retorno = com1mais > 0 ? (com2mais / com1mais) * 100 : 0;
  const retornoTxt = retorno.toFixed(1);

  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <div className="metric-label">Total de pacientes</div>
        <div className="metric-value">{total}</div>
        <div className="metric-divider" />
        <div className="metric-sub">na base</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Novos este mês</div>
        <div className="metric-value">{novosMes}</div>
        <div className="metric-divider" />
        <div className="metric-sub">novos cadastros</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Ativos</div>
        <div className="metric-value" style={{ color: "var(--vx-green)" }}>
          {ativos}
        </div>
        <div className="metric-divider" />
        <div className="metric-sub">realizado ≤ 90 dias</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Inativos</div>
        <div className="metric-value">{inativos}</div>
        <div className="metric-divider" />
        <div className="metric-sub">sem retorno recente</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Taxa de retorno</div>
        <div className="metric-value" style={{ color: "var(--vx-accent)" }}>
          {retornoTxt}
          <span style={{ fontSize: "24px", opacity: 0.6 }}>%</span>
        </div>
        <div className="metric-divider" />
        <div className="metric-sub">voltam após a 1ª visita</div>
      </div>
    </div>
  );
}
