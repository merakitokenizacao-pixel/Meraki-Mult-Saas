import { Avatar } from "@/components/avatar";
import { StatusBadge } from "@/components/status-badge";
import { fmtDate } from "@/lib/format";
import type { Lead } from "@/types/db";

// Replica o bloco "Clientes recentes" do loadDashboard: os 6 primeiros leads.
export function RecentLeads({ leads }: { leads: Lead[] }) {
  const recent = leads.slice(0, 6);

  if (recent.length === 0) {
    return (
      <div className="empty">
        <span className="empty-icon">{"\u{1F464}"}</span>
        Nenhum cliente ainda
      </div>
    );
  }

  return (
    <div className="lead-list">
      {recent.map((l) => (
        <div className="lead-item" key={l.id}>
          <Avatar nome={l.nome} fotoUrl={l.foto_url} />
          <div className="lead-info">
            <div className="lead-name">{l.nome || l.telefone}</div>
            <div className="lead-meta">{fmtDate(l.criado_em)}</div>
          </div>
          <StatusBadge status={l.status} />
        </div>
      ))}
    </div>
  );
}
