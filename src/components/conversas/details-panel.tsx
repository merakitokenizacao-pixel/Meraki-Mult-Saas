"use client";

import { Avatar } from "@/components/avatar";
import { getIASummary, getLTV, getTags, getTemp } from "@/lib/conversa";
import type { Agendamento, Lead } from "@/types/db";

// Replica renderConversaDetails: perfil do cliente (score, LTV, contato, tags, resumo, histórico).
export function DetailsPanel({
  lead,
  agendamentos,
}: {
  lead: Lead | null;
  agendamentos: Agendamento[];
}) {
  if (!lead) {
    return (
      <div className="conversa-details">
        <div className="conversa-details-empty">
          Selecione uma conversa para ver os detalhes do cliente
        </div>
      </div>
    );
  }

  const temp = getTemp(lead);
  const ltv = getLTV(lead.id, agendamentos);
  const tags = getTags(lead);
  const resumo = getIASummary(lead);
  const agends = agendamentos
    .filter((a) => a.lead_id === lead.id)
    .sort(
      (a, b) =>
        new Date(b.data_agendamento).getTime() -
        new Date(a.data_agendamento).getTime()
    );

  const origemTxt = lead.origem || lead.canal || "WhatsApp";
  const scoreTxt = temp.score != null ? temp.score : "—";
  const ltvTxt = ltv > 0 ? "R$ " + ltv.toLocaleString("pt-BR") : "—";

  return (
    <div className="conversa-details">
      <div className="details-header">
        <div className="details-avatar-wrap">
          <Avatar nome={lead.nome} fotoUrl={lead.foto_url} size={54} fontSize={16} />
        </div>
        <div className="details-name-wrap">
          <div className="details-name">{lead.nome || "—"}</div>
          <div className="details-subtitle">
            Cliente {agends.length > 1 ? "recorrente" : "recente"}
          </div>
        </div>
      </div>

      <div className="details-metrics">
        <div className="details-metric">
          <div className="details-metric-label">SCORE IA</div>
          <div className="details-metric-value">{scoreTxt}</div>
        </div>
        <div className="details-metric">
          <div className="details-metric-label">LTV</div>
          <div className="details-metric-value">{ltvTxt}</div>
        </div>
      </div>

      <div className="details-section">
        <div className="details-section-title">CONTATO</div>
        <div className="details-row">
          <span className="details-row-icon">☎</span>
          {lead.telefone || "—"}
        </div>
        <div className="details-row">
          <span className="details-row-icon">⚑</span>
          Origem: {origemTxt}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="details-section">
          <div className="details-section-title">TAGS</div>
          <div className="details-tags">
            {tags.map((t, i) => (
              <span className="details-tag" key={i}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="details-section">
        <div className="details-section-title">RESUMO DA IA</div>
        {resumo ? (
          <div className="details-ia-summary">{resumo}</div>
        ) : (
          <div
            style={{
              fontSize: 12,
              color: "var(--vx-muted)",
              fontStyle: "italic",
            }}
          >
            A IA ainda não gerou um resumo deste cliente.
          </div>
        )}
      </div>

      <div className="details-section">
        <div className="details-section-title">HISTÓRICO</div>
        <div className="details-history-list">
          {agends.length > 0 ? (
            agends.slice(0, 6).map((a) => {
              const d = new Date(a.data_agendamento);
              const dateLabel = d.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              });
              const prof = a.profissional ? " · " + a.profissional : "";
              return (
                <div className="details-history-item" key={a.id}>
                  <div className="details-history-date">{dateLabel}</div>
                  <div className="details-history-desc">
                    {a.servico || "—"}
                    {prof}
                    {a.valor ? (
                      <>
                        {" · "}
                        <span className="details-history-val">
                          R$ {Number(a.valor).toFixed(0)}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: 12, color: "var(--vx-muted)" }}>
              Nenhum atendimento registrado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
