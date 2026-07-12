import { Avatar } from "@/components/avatar";
import { StatusBadge } from "@/components/status-badge";
import { formatProximaVisita } from "@/lib/date";
import type { AgendamentoComLead } from "@/types/db";

// Card "Próximos agendamentos": o que está marcado de hoje em diante
// (sem cancelados), do mais próximo ao mais distante. Substituiu o
// "Clientes recentes" — a dona precisa ver quem vem, não quem chegou.
// Usa o status de AGENDAMENTO (pendente/confirmado/realizado), não o
// ciclo de vida do lead.
export function ProximosAgendamentos({
  agendamentos,
  onLeadClick,
}: {
  agendamentos: AgendamentoComLead[];
  onLeadClick: (leadId: string) => void;
}) {
  // Início de hoje: um horário mais cedo de hoje ainda conta como "próximo".
  const now = new Date();
  const inicioHoje = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();

  const proximos = agendamentos
    .filter(
      (a) =>
        a.status !== "cancelado" &&
        new Date(a.data_agendamento).getTime() >= inicioHoje
    )
    .sort(
      (a, b) =>
        new Date(a.data_agendamento).getTime() -
        new Date(b.data_agendamento).getTime()
    )
    .slice(0, 6);

  if (proximos.length === 0) {
    return (
      <div className="empty">
        <span className="empty-icon">{"\u{1F4C5}"}</span>
        Nenhum agendamento futuro
      </div>
    );
  }

  return (
    <div className="lead-list">
      {proximos.map((a) => {
        const nome = a.leads?.nome || a.leads?.telefone || "—";
        return (
          <div
            className="lead-item"
            key={a.id}
            onClick={() => a.lead_id && onLeadClick(a.lead_id)}
          >
            <Avatar nome={a.leads?.nome} fotoUrl={a.leads?.foto_url} />
            <div className="lead-info">
              <div className="lead-name">{nome}</div>
              <div className="lead-meta">
                {formatProximaVisita(a.data_agendamento)}
                {a.servico ? ` · ${a.servico}` : ""}
              </div>
            </div>
            <StatusBadge status={a.status} />
          </div>
        );
      })}
    </div>
  );
}
