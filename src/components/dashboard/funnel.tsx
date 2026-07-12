import type { Lead, Agendamento } from "@/types/db";

// Funil de conversão. Todos os passos são DERIVADOS de `agendamentos` e
// contam LEADS (não linhas de agendamento), formando subconjuntos aninhados:
//   todos ⊇ com agendamento ⊇ não-cancelado ⊇ realizado
// Antes, "Engajados" e "Agendados" liam `leads.status` ('novo'/'agendado') —
// valores que o novo modelo de ciclo de vida não grava mais, então os passos
// zeravam. "Tem horário" nunca foi ciclo de vida: é derivado. Ver CLAUDE.md.
export function Funnel({
  leads,
  agendamentos,
}: {
  leads: Lead[];
  agendamentos: Agendamento[];
}) {
  const total = leads.length;

  const leadsCom = new Set<string>();
  const leadsNaoCancelado = new Set<string>();
  const leadsRealizado = new Set<string>();
  for (const a of agendamentos) {
    if (!a.lead_id) continue;
    leadsCom.add(a.lead_id);
    if (a.status !== "cancelado") leadsNaoCancelado.add(a.lead_id);
    if (a.status === "realizado") leadsRealizado.add(a.lead_id);
  }

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const steps = [
    { label: "Clientes", count: total, pct: 100, color: "var(--vx-blue)" },
    {
      label: "Engajados",
      count: leadsCom.size,
      pct: pct(leadsCom.size),
      color: "var(--vx-accent)",
    },
    {
      label: "Agendados",
      count: leadsNaoCancelado.size,
      pct: pct(leadsNaoCancelado.size),
      color: "var(--vx-gold)",
    },
    {
      label: "Realizados",
      count: leadsRealizado.size,
      pct: pct(leadsRealizado.size),
      color: "var(--vx-green)",
    },
  ];

  return (
    <div className="funnel">
      {steps.map((s) => (
        <div className="funnel-step" key={s.label}>
          <div className="funnel-row">
            <span className="funnel-label">{s.label}</span>
            <span className="funnel-count">{s.count}</span>
          </div>
          <div className="funnel-track">
            <div
              className="funnel-fill"
              style={{ width: `${s.pct}%`, background: s.color }}
            />
          </div>
          <div className="funnel-pct">{s.pct}%</div>
        </div>
      ))}
    </div>
  );
}
