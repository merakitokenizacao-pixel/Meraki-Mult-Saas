import { Avatar } from "@/components/avatar";
import { nomesDoAgendamento } from "@/lib/nome-agendamento";
import { LeadStatusBadge } from "@/components/lead-status-badge";
import { fmtDate, formatTelefone, nomeCanal } from "@/lib/format";
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
            // Lead sem nome existe: o n8n cria pelo telefone assim que a
            // pessoa manda a primeira mensagem, e o nome só chega depois. A
            // linha mostrava um travessão ao lado de um avatar vazio e parecia
            // registro quebrado — o telefone É o identificador dela, então é
            // ele que vai no lugar do nome.
            const telefone = formatTelefone(l.telefone);
            const semNome = !l.nome?.trim();
            return (
              <tr key={l.id} onClick={() => onRowClick(l)}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar nome={l.nome} fotoUrl={l.foto_url} size={30} fontSize={10} />
                    <span className={semNome ? "lead-sem-nome" : undefined}>
                      {semNome ? telefone : l.nome}
                    </span>
                  </div>
                </td>
                {/* Sem nome, o telefone já é a identificação na primeira
                    coluna; repetir aqui seria a mesma informação duas vezes. */}
                <td className="muted">{semNome ? "—" : telefone}</td>
                <td className="muted">{nomeCanal(l.canal)}</td>
                <td>
                  <LeadStatusBadge status={l.status} />
                </td>
                <td>
                  {visita ? (
                    <div style={{ lineHeight: 1.3 }}>
                      <div style={{ fontWeight: 500 }}>
                        {formatProximaVisita(visita.data_agendamento)}
                      </div>
                      {/* A linha é do titular do WhatsApp, mas a visita pode
                          ser PARA OUTRA PESSOA — e é aqui que a confusão
                          aparece: a Ingrid tem visita marcada, quem vai é a
                          Maria Dagmar. */}
                      {nomesDoAgendamento(visita.nome_cliente, l.nome)
                        .titular && (
                        <div className="lead-visita-para">
                          para {visita.nome_cliente}
                        </div>
                      )}
                      {visita.servico && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--mk-tinta-fraca)",
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
