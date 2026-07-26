import { filterByDate } from "@/lib/date";
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

  // Taxa de conversão = DOS LEADS CAPTADOS NO PERÍODO, quantos AGENDARAM.
  // (Coorte: denominador = captados no período; o agendamento deles pode ter
  // sido feito a qualquer momento, por isso o numerador olha TODOS os
  // agendamentos, não só os do período.)
  //
  // O sinal "agendou" NÃO mora mais em `leads.status`: o novo ciclo de vida só
  // grava novo/cliente/inativo, e a conta antiga procurava 'agendado'/
  // 'convertido' ali — gaveta que ficou vazia, então dava 0% sempre. O sinal
  // migrou para a tabela `agendamentos`; é de lá que ele é derivado agora.
  const leadsQueAgendaram = new Set(
    agendamentos.map((a) => a.lead_id).filter(Boolean)
  );
  const agendaram = filtered.filter((l) => leadsQueAgendaram.has(l.id)).length;
  // Sem leads captados no período não existe taxa (0/0) — mostra "—", não 0%.
  const temTaxa = total > 0;
  const taxa = temTaxa ? Math.round((agendaram / total) * 100) : 0;

  // "Consultas agendadas" e "Receita estimada" usam o MESMO conjunto:
  // agendamentos por DATA_AGENDAMENTO (quando o atendimento ACONTECE), sem
  // cancelados.
  //
  // Já foi por `criado_em` (quando a consulta foi MARCADA). Trocado em jul/2026
  // porque a leitura operacional é a que a dona espera: num domingo — primeiro
  // dia da semana — nada tinha sido marcado ainda, e o card mostrava "Semana: 0"
  // enquanto havia 29 atendimentos acontecendo naquela semana. Contar por
  // criado_em respondia "quanto a Laura captou"; o card responde agora "quanto
  // trabalho eu tenho no período", que é o que se olha num painel de operação.
  const agendsPeriodo =
    period === "tudo"
      ? agendamentos
      : filterByDate(agendamentos, "data_agendamento", period);
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
        {/* O subtítulo antigo dizia "clientes confirmados" — errado em dois
            sentidos: conta atendimentos (não pessoas) e inclui os pendentes. */}
        <div className="metric-sub up">atendimentos no período</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Taxa de conversão</div>
        <div className="metric-value" style={{ color: "var(--vx-amber)" }}>
          {temTaxa ? (
            <>
              {taxa}
              <span style={{ fontSize: "24px", opacity: 0.6 }}>%</span>
            </>
          ) : (
            "—"
          )}
        </div>
        <div className="metric-divider" />
        <div className="metric-sub">
          {temTaxa
            ? `${agendaram} de ${total} captados agendaram`
            : "nenhum lead captado no período"}
        </div>
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
