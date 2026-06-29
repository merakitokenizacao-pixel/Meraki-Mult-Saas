import { Avatar } from "@/components/avatar";
import { StatusBadge } from "@/components/status-badge";
import { fmtDate } from "@/lib/format";
import type { Lead } from "@/types/db";

// Replica renderLeadsTable: linhas clicáveis com avatar, telefone, canal, status e "desde".
export function LeadsTable({
  leads,
  loading,
  onRowClick,
}: {
  leads: Lead[];
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
          <th>Desde</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={5}>
              <div className="loading">
                <div className="spinner" /> Carregando...
              </div>
            </td>
          </tr>
        ) : leads.length === 0 ? (
          <tr>
            <td colSpan={5}>
              <div className="empty">Nenhum cliente encontrado</div>
            </td>
          </tr>
        ) : (
          leads.map((l) => (
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
                <StatusBadge status={l.status} />
              </td>
              <td className="muted">{fmtDate(l.criado_em)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
