"use client";

import { Flag, Phone, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { getIASummary, getLTV } from "@/lib/conversa";
import { PanelSkeleton } from "@/components/conversas/skeletons";
import type { Agendamento, Lead } from "@/types/db";

const sectionTitle = "mb-3 text-[9px] font-bold tracking-[0.12em] text-mk-muted";

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
    <div className="flex h-full min-h-0 flex-col border-l border-mk-border bg-mk-surface">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-mk-border px-6">
        <span className="text-[13px] font-semibold text-mk-text">
          Detalhes
        </span>
        <button
          onClick={onClose}
          aria-label="Fechar painel"
          className="grid h-8 w-8 place-items-center rounded-lg text-mk-muted transition-colors hover:bg-mk-surface2 hover:text-mk-text"
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <PanelSkeleton />
        ) : !lead ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-[12px] text-mk-muted">
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
      <div className="flex items-center gap-3 border-b border-mk-border p-6">
        <Avatar nome={lead.nome} fotoUrl={lead.foto_url} size={54} fontSize={16} />
        <div className="min-w-0">
          <div className="truncate text-[16px] font-semibold text-mk-text">
            {lead.nome || "—"}
          </div>
          <div className="text-[11px] text-mk-muted">
            Cliente {agends.length > 1 ? "recorrente" : "recente"}
          </div>
        </div>
      </div>

      {/* SCORE IA saiu: a coluna `leads.score_ia` foi removida do banco em
          ago/2026, então o card mostrava "—" para todo cliente, sempre. O LTV
          ficou e agora vale de verdade — `agendamentos.valor` passou a ser
          preenchido pelo trigger de precificação. */}
      <div className="grid grid-cols-2 gap-3 border-b border-mk-border p-6">
        <div className="rounded-xl bg-mk-surface2 p-3">
          <div className="text-[9px] font-bold tracking-[0.1em] text-mk-muted">
            LTV
          </div>
          <div className="mt-1 font-mono text-[18px] font-semibold text-mk-accent">
            {ltvTxt}
          </div>
        </div>
        <div className="rounded-xl bg-mk-surface2 p-3">
          <div className="text-[9px] font-bold tracking-[0.1em] text-mk-muted">
            ATENDIMENTOS
          </div>
          <div className="mt-1 font-mono text-[18px] font-semibold text-mk-accent">
            {agends.filter((a) => a.status === "realizado").length || "—"}
          </div>
        </div>
      </div>

      <div className="border-b border-mk-border p-6">
        <div className={sectionTitle}>CONTATO</div>
        <div className="flex items-center gap-2.5 py-1 text-[12.5px] text-mk-text">
          <Phone size={14} className="text-mk-muted" /> {lead.telefone || "—"}
        </div>
        <div className="flex items-center gap-2.5 py-1 text-[12.5px] text-mk-text">
          <Flag size={14} className="text-mk-muted" /> Origem: {origemTxt}
        </div>
      </div>


      <div className="border-b border-mk-border p-6">
        <div className={sectionTitle}>RESUMO DA IA</div>
        {resumo ? (
          <p className="border-l-2 border-mk-accent pl-3 text-[12.5px] italic leading-relaxed text-mk-text2">
            {resumo}
          </p>
        ) : (
          <p className="text-[12px] italic text-mk-muted">
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
                  <div className="font-mono text-[10.5px] uppercase text-mk-muted">
                    {dateLabel}
                  </div>
                  <div className="leading-snug text-mk-text">
                    {a.servico || "—"}
                    {prof}
                    {a.valor ? (
                      <>
                        {" · "}
                        <span className="font-mono font-semibold text-mk-accent">
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
          <p className="text-[12px] text-mk-muted">Nenhum atendimento registrado</p>
        )}
      </div>
    </>
  );
}
