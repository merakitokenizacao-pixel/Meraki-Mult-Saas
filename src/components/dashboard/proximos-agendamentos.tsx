import { Avatar } from "@/components/avatar";
import { StatusBadge } from "@/components/status-badge";
import { limparServico } from "@/lib/format";
import type { AgendamentoComLead } from "@/types/db";

// Próximos agendamentos: de hoje em diante (>= início de hoje), sem cancelados,
// ordem crescente. Sempre futuro, independente de qualquer filtro.
export function ProximosAgendamentos({
  agendamentos,
}: {
  agendamentos: AgendamentoComLead[];
}) {
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
        a.data_agendamento &&
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
        const d = new Date(a.data_agendamento);
        const dataTxt = d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
        });
        const horaTxt = d.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const nome = a.leads?.nome || a.leads?.telefone || "Cliente";
        return (
          <div className="lead-item" key={a.id}>
            <Avatar nome={a.leads?.nome} fotoUrl={a.leads?.foto_url} />
            <div className="lead-info">
              <div className="lead-name">{nome}</div>
              <div className="lead-meta">
                {dataTxt} · {horaTxt} · {limparServico(a.servico)}
              </div>
            </div>
            <StatusBadge status={a.status} />
          </div>
        );
      })}
    </div>
  );
}
