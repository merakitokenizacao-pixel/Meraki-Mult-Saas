"use client";

import { useState } from "react";
import {
  Bell,
  BellOff,
  Bot,
  Clock,
  Inbox,
  MessagesSquare,
  RefreshCw,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DateFilter } from "@/components/date-filter";
import { getRelativeTime } from "@/lib/format";
import { getLastMsgPreview, lastMsgInfo } from "@/lib/conversa";
import { InboxSkeleton } from "@/components/conversas/skeletons";
import type { Conversa, Lead } from "@/types/db";

export type InboxTab = "tudo" | "ia" | "humano" | "inativo";

// Filtros como chips de ícone + contador (compacto, estilo DataCraze).
const TABS: ReadonlyArray<[InboxTab, string, LucideIcon]> = [
  ["tudo", "Tudo", Inbox],
  ["ia", "IA", Bot],
  ["humano", "Humano", UserRound],
  ["inativo", "Inativo", Clock],
];

// Filtro por última atividade da conversa (não por criação do lead).
const PERIODS: ReadonlyArray<[string, string]> = [
  ["tudo", "Tudo"],
  ["hoje", "Hoje"],
  ["ontem", "Ontem"],
  ["semana", "Semana"],
  ["mes", "Mês"],
];

export function InboxList({
  leads,
  conversas,
  tab,
  counts,
  period,
  currentLeadId,
  loading,
  somLigado,
  onAlternarSom,
  onSelectTab,
  onSelectPeriod,
  onSelectLead,
  onRefresh,
}: {
  leads: Lead[];
  conversas: Conversa[];
  tab: InboxTab;
  counts: Record<InboxTab, number>;
  period: string;
  currentLeadId: string | null;
  loading: boolean;
  somLigado: boolean;
  onAlternarSom: () => void;
  onSelectTab: (t: InboxTab) => void;
  onSelectPeriod: (p: string) => void;
  onSelectLead: (id: string) => void;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const tabAtual = TABS.find(([v]) => v === tab) ?? TABS[0];

  const q = query.trim().toLowerCase();
  const filtered = q
    ? leads.filter(
        (l) =>
          (l.nome || "").toLowerCase().includes(q) ||
          (l.telefone || "").includes(query.trim())
      )
    : leads;

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-mk-border bg-mk-surface">
      {/* Header compacto: busca+ações · filtro ativo+contador+período · chips */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-mk-border px-4 pb-3 pt-3.5">
        <div className="flex items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <Search size={15} strokeWidth={1.5} className="shrink-0 text-mk-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquise seus contatos"
              aria-label="Buscar conversa"
              className="w-full bg-transparent text-[13px] text-mk-text outline-none placeholder:text-mk-muted"
            />
          </label>
          <button
            type="button"
            onClick={onAlternarSom}
            title={
              somLigado
                ? "Aviso sonoro ligado — clique para silenciar"
                : "Aviso sonoro desligado — clique para ligar"
            }
            aria-label="Aviso sonoro de mensagem nova"
            aria-pressed={somLigado}
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors hover:bg-mk-surface2 ${
              somLigado
                ? "text-mk-accent"
                : "text-mk-muted opacity-60 hover:text-mk-text"
            }`}
          >
            {somLigado ? (
              <Bell size={15} strokeWidth={1.5} />
            ) : (
              <BellOff size={15} strokeWidth={1.5} />
            )}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            title="Atualizar"
            aria-label="Atualizar"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-mk-muted transition-colors hover:bg-mk-surface2 hover:text-mk-text"
          >
            <RefreshCw size={15} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-[14px] font-semibold text-mk-text">
              {tabAtual[1]}
            </h2>
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-mk-surface3 px-1.5 font-mono text-[10px] font-bold text-mk-text2">
              {counts[tab]}
            </span>
          </div>
          <DateFilter
            value={period}
            options={PERIODS}
            onChange={onSelectPeriod}
            compact
          />
        </div>

        <div className="flex items-center gap-1.5">
          {TABS.map(([value, label, Icon]) => {
            const active = tab === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onSelectTab(value)}
                title={label}
                aria-label={label}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-mk-accent bg-mk-accent-light text-mk-accent"
                    : "border-mk-border bg-mk-surface2 text-mk-muted hover:border-mk-border2 hover:text-mk-text2"
                }`}
              >
                <Icon size={14} strokeWidth={1.6} />
                {counts[value]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <InboxSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-mk-border bg-mk-surface2">
              <MessagesSquare size={24} strokeWidth={1.5} className="text-mk-muted" />
            </div>
            <p className="text-[13px] text-mk-muted">
              {q ? "Nada encontrado" : "Sem conversas iniciadas"}
            </p>
          </div>
        ) : (
          filtered.map((l) => {
            const preview = getLastMsgPreview(l, conversas);
            const { raw } = lastMsgInfo(l, conversas);
            const unread = Number(l.nao_lidas) || 0;
            const showUnread = unread > 0 && currentLeadId !== l.id;
            const active = currentLeadId === l.id;
            return (
              <button
                key={l.id}
                onClick={() => onSelectLead(l.id)}
                className={`flex w-full items-center gap-3 border-b border-mk-border/50 px-6 py-3 text-left transition-colors ${
                  active
                    ? "bg-mk-accent-light shadow-[inset_2px_0_0_var(--mk-accent)]"
                    : "hover:bg-mk-surface2/60"
                }`}
              >
                <Avatar nome={l.nome} fotoUrl={l.foto_url} size={44} fontSize={12} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-mk-text">
                      {l.nome || l.telefone || "—"}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-mk-muted">
                      {getRelativeTime(raw)}
                    </span>
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-2">
                    <span className="truncate text-[12px] text-mk-muted">
                      {preview.text}
                    </span>
                  </div>
                </div>
                {showUnread && (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-mk-accent px-1.5 font-mono text-[10px] font-bold text-mk-on-accent">
                    {unread}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
