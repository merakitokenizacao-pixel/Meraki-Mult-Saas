import type { Lead, Agendamento } from "@/types/db";

// Funil de conversão. Conta PESSOAS (leads distintos), não linhas de
// agendamento — um funil narrowing só faz sentido por gente: um cliente que
// fez 10 sessões é 1 pessoa que compareceu, não 10. Por isso "Compareceram"
// (39) é menor que o total de agendamentos realizados (76): os clientes
// repetem. Para o VOLUME de procedimentos, ver o card "Consultas agendadas".
//
// Três estágios ANINHADOS e distintos:
//   todos os leads  ⊇  agendaram (não-cancelado)  ⊇  compareceram (realizado)
// O antigo "Engajados" (tem qualquer agendamento, mesmo cancelado) saiu:
// ficava idêntico a "Agendaram" e não representava um estágio real.
export function Funnel({
  leads,
  agendamentos,
  responderam,
}: {
  leads: Lead[];
  agendamentos: Agendamento[];
  /** Quem escreveu para a clínica pelo menos uma vez. */
  responderam: Set<string> | null;
}) {
  // O topo do funil é quem FALOU, não quem está na tabela. A dona disparou
  // para a lista antiga dela: dos 956 leads, 651 nunca responderam. Com eles
  // no topo, Agendaram caía para 7% e o funil dizia que a clínica não
  // converte — quando o que não converte é uma lista fria.
  const base = responderam
    ? leads.filter((l) => responderam.has(l.id))
    : leads;
  const total = base.length;

  // Os estágios seguintes também saem da MESMA base, senão o funil alarga no
  // meio: alguém que agendou sem nunca ter escrito (cadastro de balcão)
  // apareceria em Agendaram sem estar em Clientes.
  const naBase = new Set(base.map((l) => l.id));
  const leadsAgendaram = new Set<string>();
  const leadsCompareceram = new Set<string>();
  for (const a of agendamentos) {
    if (!a.lead_id || !naBase.has(a.lead_id)) continue;
    if (a.status !== "cancelado") leadsAgendaram.add(a.lead_id);
    if (a.status === "realizado") leadsCompareceram.add(a.lead_id);
  }

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const steps = [
    { label: "Clientes", count: total, pct: 100, color: "var(--vx-blue)" },
    {
      label: "Agendaram",
      count: leadsAgendaram.size,
      pct: pct(leadsAgendaram.size),
      color: "var(--vx-gold)",
    },
    {
      label: "Compareceram",
      count: leadsCompareceram.size,
      pct: pct(leadsCompareceram.size),
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
