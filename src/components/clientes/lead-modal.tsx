"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { Avatar } from "@/components/avatar";
import { StatusBadge } from "@/components/status-badge";
import { LeadStatusBadge } from "@/components/lead-status-badge";
import { fmtDate } from "@/lib/format";
import { getAgendamentosByLead, getConversasByLead } from "@/lib/queries";
import { FichaSection } from "@/components/painel/ficha-section";
import { DispensaEnvios } from "@/components/configuracoes/secao-envios";
import { salvarDispensa } from "@/lib/envios-db";
import { showToast } from "@/lib/toast";
import type { TipoEnvio } from "@/lib/envios";
import type { Agendamento, Conversa, Lead } from "@/types/db";

// Replica openLeadModal: detalhe do lead + agendamentos + prévia da conversa.
export function LeadModal({
  lead,
  onClose,
}: {
  lead: Lead | null;
  onClose: () => void;
}) {
  const [convs, setConvs] = useState<Conversa[]>([]);
  const [agends, setAgends] = useState<Agendamento[]>([]);
  // Espelho local da dispensa: o modal recebe o lead por prop e não tem como
  // pedir ao pai que recarregue, então o estado da marcação mora aqui.
  const [dispensa, setDispensa] = useState<string[]>([]);

  useEffect(() => {
    if (!lead) return;
    let ativo = true;
    setConvs([]);
    setAgends([]);
    setDispensa(lead.dispensa_envios ?? []);
    (async () => {
      try {
        const [c, a] = await Promise.all([
          getConversasByLead(lead.id),
          getAgendamentosByLead(lead.id),
        ]);
        if (ativo) {
          setConvs(c);
          setAgends(a);
        }
      } catch {
        /* silencioso, como o legacy */
      }
    })();
    return () => {
      ativo = false;
    };
  }, [lead]);

  return (
    <Modal open={!!lead} onClose={onClose}>
      {lead && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: "1.25rem",
            }}
          >
            <Avatar
              nome={lead.nome}
              fotoUrl={lead.foto_url}
              size={48}
              fontSize={15}
              style={{ border: "2px solid var(--mk-linha)" }}
            />
            <div>
              <div className="modal-name">{lead.nome || "—"}</div>
              <div className="modal-phone">{lead.telefone}</div>
            </div>
            <LeadStatusBadge status={lead.status} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                background: "var(--mk-superficie-2)",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: "var(--mk-tinta-fraca)",
                  marginBottom: 4,
                  fontWeight: 700,
                }}
              >
                CANAL
              </div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                {lead.canal || "whatsapp"}
              </div>
            </div>
            <div
              style={{
                background: "var(--mk-superficie-2)",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: "var(--mk-tinta-fraca)",
                  marginBottom: 4,
                  fontWeight: 700,
                }}
              >
                PRIMEIRO CONTATO
              </div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                {fmtDate(lead.criado_em)}
              </div>
            </div>
          </div>

          <div className="modal-section">Agendamentos ({agends.length})</div>
          {agends.length > 0 ? (
            agends.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  background: "var(--mk-superficie-2)",
                  borderRadius: 10,
                  marginBottom: 6,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {a.servico || "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--mk-tinta-fraca)" }}>
                    {fmtDate(a.data_agendamento)}
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))
          ) : (
            <div
              style={{
                fontSize: 12,
                color: "var(--mk-tinta-fraca)",
                padding: "8px 0",
              }}
            >
              Nenhum agendamento
            </div>
          )}

          <FichaSection leadId={lead.id} />

          {/* O override manual. A regra automática (Configurações → Envios)
              pega o caso comum; aqui entra a exceção que o número não pega —
              e `envio_pode` confere esta lista ANTES de pausa, opt-out e
              frequência. Manual sempre vence. */}
          <div className="modal-section">Não enviar automaticamente</div>
          <DispensaEnvios
            valor={dispensa}
            onMudar={async (tipos: TipoEnvio[]) => {
              const antes = dispensa;
              setDispensa(tipos);
              try {
                await salvarDispensa(lead.id, tipos);
              } catch {
                setDispensa(antes);
                showToast("Não foi possível salvar a dispensa", "error");
              }
            }}
          />

          <div className="modal-section">Conversa ({convs.length} msgs)</div>
          <div
            style={{
              maxHeight: 220,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {convs.length > 0 ? (
              convs.slice(-10).map((m) => {
                const isA = m.origem === "agente";
                return (
                  <div
                    key={m.id}
                    className={`msg-bubble${isA ? " agente" : ""}`}
                    style={{ animation: "none" }}
                  >
                    <div className="msg-content">
                      <div className="msg-text" style={{ fontSize: 12 }}>
                        {m.mensagem}
                      </div>
                      <div className="msg-time">{fmtDate(m.enviado_em)}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ fontSize: 12, color: "var(--mk-tinta-fraca)" }}>
                Nenhuma mensagem
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
