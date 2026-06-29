import type { Lead, Agendamento } from "@/types/db";

// Replica o funil do loadDashboard (sobre TODOS os leads, não filtrado por período).
export function Funnel({
  leads,
  agendamentos,
}: {
  leads: Lead[];
  agendamentos: Agendamento[];
}) {
  const total = leads.length;
  const engajados = leads.filter((l) => l.status !== "novo").length;
  const agendados = leads.filter((l) => l.status === "agendado").length;
  const realizados = agendamentos.filter((a) => a.status === "realizado").length;

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const steps = [
    { label: "Clientes", count: total, pct: 100, color: "var(--vx-blue)" },
    { label: "Engajados", count: engajados, pct: pct(engajados), color: "var(--vx-accent)" },
    { label: "Agendados", count: agendados, pct: pct(agendados), color: "var(--vx-gold)" },
    { label: "Realizados", count: realizados, pct: pct(realizados), color: "var(--vx-green)" },
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
