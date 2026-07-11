import { leadStatusDisplay } from "@/lib/status";

// Badge do CICLO DE VIDA do lead (novo/cliente/inativo). Distinto do
// StatusBadge, que é do status de AGENDAMENTO (pendente/confirmado/…).
// Todo o mapeamento vem de lib/status.ts — não repetir em lugar nenhum.
export function LeadStatusBadge({ status }: { status?: string | null }) {
  const { label, variant } = leadStatusDisplay(status);
  return <span className={`badge badge-lead-${variant}`}>{label}</span>;
}
