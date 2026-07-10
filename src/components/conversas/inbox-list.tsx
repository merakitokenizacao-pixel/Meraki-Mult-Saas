"use client";

import { useState } from "react";
import {
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
    <div className="flex h-full min-h-0 flex-col border-r border-vx-border bg-vx-surface">
      {/* Header compacto: busca+ações · filtro ativo+contador+período · chips */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-vx-border px-4 pb-3 pt-3.5">
        <div className="flex items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <Search size={15} strokeWidth={1.5} className="shrink-0 text-vx-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquise seus contatos"
              aria-label="Buscar conversa"
              className="w-full bg-transparent text-[13px] text-vx-text outline-none placeholder:text-vx-muted"
            />
          </label>
          <button
            type="button"
            onClick={onRefresh}
            title="Atualizar"
            aria-label="Atualizar"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-vx-muted transition-colors hover:bg-vx-surface2 hover:text-vx-text"
          >
            <RefreshCw size={15} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-[14px] font-semibold text-vx-text">
              {tabAtual[1]}
            </h2>
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-vx-surface3 px-1.5 font-mono text-[10px] font-bold text-vx-text2">
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
                    ? "border-vx-accent bg-vx-accent-light text-vx-accent"
                    : "border-vx-border bg-vx-surface2 text-vx-muted hover:border-vx-border2 hover:text-vx-text2"
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
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-vx-border bg-vx-surface2">
              <MessagesSquare size={24} strokeWidth={1.5} className="text-vx-muted" />
            </div>
            <p className="text-[13px] text-vx-muted">
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
                className={`flex w-full items-center gap-3 border-b border-vx-border/50 px-6 py-3 text-left transition-colors ${
                  active
                    ? "bg-vx-accent-light shadow-[inset_2px_0_0_var(--vx-accent)]"
                    : "hover:bg-vx-surface2/60"
                }`}
              >
                <Avatar nome={l.nome} fotoUrl={l.foto_url} size={44} fontSize={12} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-vx-text">
                      {l.nome || l.telefone || "—"}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-vx-muted">
                      {getRelativeTime(raw)}
                    </span>
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-2">
                    <span className="truncate text-[12px] text-vx-muted">
                      {preview.text}
                    </span>
                  </div>
                </div>
                {showUnread && (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-vx-accent px-1.5 font-mono text-[10px] font-bold text-white dark:text-[#1a1814]">
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
