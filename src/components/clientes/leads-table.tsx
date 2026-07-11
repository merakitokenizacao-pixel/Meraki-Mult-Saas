import { Avatar } from "@/components/avatar";
import { LeadStatusBadge } from "@/components/lead-status-badge";
import { fmtDate } from "@/lib/format";
import { formatProximaVisita } from "@/lib/date";
import type { Lead } from "@/types/db";
import type { ProximaVisita } from "@/lib/queries";

// Replica renderLeadsTable + coluna "Próxima visita" (derivada de agendamentos).
export function LeadsTable({
  leads,
  proximasVisitas,
  loading,
  onRowClick,
}: {
  leads: Lead[];
  proximasVisitas: Map<string, ProximaVisita>;
  loading: boolean;
  onRowClick: (lead: Lead) => void;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Telefone</th>
          <th>Canal</th>
          <th>Status</th>
          <th>Próxima visita</th>
          <th>Desde</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={6}>
              <div className="loading">
                <div className="spinner" /> Carregando...
              </div>
            </td>
          </tr>
        ) : leads.length === 0 ? (
          <tr>
            <td colSpan={6}>
              <div className="empty">Nenhum cliente encontrado</div>
            </td>
          </tr>
        ) : (
          leads.map((l) => {
            const visita = proximasVisitas.get(l.id);
            return (
              <tr key={l.id} onClick={() => onRowClick(l)}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar nome={l.nome} fotoUrl={l.foto_url} size={30} fontSize={10} />
                    <span>{l.nome || "—"}</span>
                  </div>
                </td>
                <td className="muted">{l.telefone || "—"}</td>
                <td className="muted">{l.canal || "whatsapp"}</td>
                <td>
                  <LeadStatusBadge status={l.status} />
                </td>
                <td>
                  {visita ? (
                    <div style={{ lineHeight: 1.3 }}>
                      <div style={{ fontWeight: 500 }}>
                        {formatProximaVisita(visita.data_agendamento)}
                      </div>
                      {visita.servico && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--vx-muted)",
                            maxWidth: 160,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={visita.servico}
                        >
                          {visita.servico}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="muted">{fmtDate(l.criado_em)}</td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
