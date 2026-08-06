"use client";

import { Flag, Phone, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { getIASummary, getLTV } from "@/lib/conversa";
import { PanelSkeleton } from "@/components/conversas/skeletons";
import type { Agendamento, Lead } from "@/types/db";

const sectionTitle = "mb-3 text-[9px] font-bold tracking-[0.12em] text-vx-muted";

// Painel do cliente (colapsável). LTV, contato, resumo da IA e histórico.
export function DetailsPanel({
  lead,
  agendamentos,
  loading,
  onClose,
}: {
  lead: Lead | null;
  agendamentos: Agendamento[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col border-l border-vx-border bg-vx-surface">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-vx-border px-6">
        <span className="font-serif text-[17px] font-medium text-vx-text">
          Detalhes
        </span>
        <button
          onClick={onClose}
          aria-label="Fechar painel"
          className="grid h-8 w-8 place-items-center rounded-lg text-vx-muted transition-colors hover:bg-vx-surface2 hover:text-vx-text"
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <PanelSkeleton />
        ) : !lead ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-[12px] text-vx-muted">
            Selecione uma conversa para ver os detalhes do cliente
          </div>
        ) : (
          <DetailsContent lead={lead} agendamentos={agendamentos} />
        )}
      </div>
    </div>
  );
}

function DetailsContent({
  lead,
  agendamentos,
}: {
  lead: Lead;
  agendamentos: Agendamento[];
}) {
  const ltv = getLTV(lead.id, agendamentos);
  const resumo = getIASummary(lead);
  const agends = agendamentos
    .filter((a) => a.lead_id === lead.id)
    .sort(
      (a, b) =>
        new Date(b.data_agendamento).getTime() -
        new Date(a.data_agendamento).getTime()
    );

  // `leads.origem` foi removida; o canal do lead é `canal`.
  const origemTxt = lead.canal || "WhatsApp";
  const ltvTxt = ltv > 0 ? "R$ " + ltv.toLocaleString("pt-BR") : "—";

  return (
    <>
      <div className="flex items-center gap-3 border-b border-vx-border p-6">
        <Avatar nome={lead.nome} fotoUrl={lead.foto_url} size={54} fontSize={16} />
        <div className="min-w-0">
          <div className="truncate font-serif text-[20px] font-medium text-vx-text">
            {lead.nome || "—"}
          </div>
          <div className="text-[11px] text-vx-muted">
            Cliente {agends.length > 1 ? "recorrente" : "recente"}
          </div>
        </div>
      </div>

      {/* SCORE IA saiu: a coluna `leads.score_ia` foi removida do banco em
          ago/2026, então o card mostrava "—" para todo cliente, sempre. O LTV
          ficou e agora vale de verdade — `agendamentos.valor` passou a ser
          preenchido pelo trigger de precificação. */}
      <div className="grid grid-cols-2 gap-3 border-b border-vx-border p-6">
        <div className="rounded-xl bg-vx-surface2 p-3">
          <div className="text-[9px] font-bold tracking-[0.1em] text-vx-muted">
            LTV
          </div>
          <div className="mt-1 font-mono text-[18px] font-semibold text-vx-accent">
            {ltvTxt}
          </div>
        </div>
        <div className="rounded-xl bg-vx-surface2 p-3">
          <div className="text-[9px] font-bold tracking-[0.1em] text-vx-muted">
            ATENDIMENTOS
          </div>
          <div className="mt-1 font-mono text-[18px] font-semibold text-vx-accent">
            {agends.filter((a) => a.status === "realizado").length || "—"}
          </div>
        </div>
      </div>

      <div className="border-b border-vx-border p-6">
        <div className={sectionTitle}>CONTATO</div>
        <div className="flex items-center gap-2.5 py-1 text-[12.5px] text-vx-text">
          <Phone size={14} className="text-vx-muted" /> {lead.telefone || "—"}
        </div>
        <div className="flex items-center gap-2.5 py-1 text-[12.5px] text-vx-text">
          <Flag size={14} className="text-vx-muted" /> Origem: {origemTxt}
        </div>
      </div>


      <div className="border-b border-vx-border p-6">
        <div className={sectionTitle}>RESUMO DA IA</div>
        {resumo ? (
          <p className="border-l-2 border-vx-accent pl-3 text-[12.5px] italic leading-relaxed text-vx-text2">
            {resumo}
          </p>
        ) : (
          <p className="text-[12px] italic text-vx-muted">
            A IA ainda não gerou um resumo deste cliente.
          </p>
        )}
      </div>

      <div className="p-6">
        <div className={sectionTitle}>HISTÓRICO</div>
        {agends.length > 0 ? (
          <div className="space-y-2">
            {agends.slice(0, 6).map((a) => {
              const d = new Date(a.data_agendamento);
              const dateLabel = d.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              });
              const prof = a.profissional ? " · " + a.profissional : "";
              return (
                <div
                  key={a.id}
                  className="grid grid-cols-[48px_1fr] items-baseline gap-2.5 text-[12px]"
                >
                  <div className="font-mono text-[10.5px] uppercase text-vx-muted">
                    {dateLabel}
                  </div>
                  <div className="leading-snug text-vx-text">
                    {a.servico || "—"}
                    {prof}
                    {a.valor ? (
                      <>
                        {" · "}
                        <span className="font-mono font-semibold text-vx-accent">
                          R$ {Number(a.valor).toFixed(0)}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[12px] text-vx-muted">Nenhum atendimento registrado</p>
        )}
      </div>
    </>
  );
}
