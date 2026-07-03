"use client";

import { useState } from "react";
import { Search, MessagesSquare } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { StatusBadge } from "@/components/status-badge";
import { getRelativeTime } from "@/lib/format";
import { getLastMsgPreview, lastMsgInfo } from "@/lib/conversa";
import type { Conversa, Lead } from "@/types/db";

export type InboxTab = "tudo" | "ia" | "humano" | "inativo";

const TABS: ReadonlyArray<[InboxTab, string]> = [
  ["tudo", "Tudo"],
  ["ia", "IA"],
  ["humano", "Humano"],
  ["inativo", "Inativo"],
];

export function InboxList({
  leads,
  conversas,
  tab,
  counts,
  currentLeadId,
  loading,
  onSelectTab,
  onSelectLead,
}: {
  leads: Lead[];
  conversas: Conversa[];
  tab: InboxTab;
  counts: Record<InboxTab, number>;
  currentLeadId: string | null;
  loading: boolean;
  onSelectTab: (t: InboxTab) => void;
  onSelectLead: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

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
      {/* Header: busca + título + chips */}
      <div className="flex shrink-0 flex-col gap-4 px-6 pb-4 pt-6">
        <label className="flex items-center gap-2.5 rounded-xl border border-vx-border bg-vx-surface2 px-3.5 py-2.5 transition-colors focus-within:border-vx-accent focus-within:bg-vx-surface">
          <Search size={16} strokeWidth={1.5} className="shrink-0 text-vx-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversa..."
            aria-label="Buscar conversa"
            className="w-full bg-transparent text-[13px] text-vx-text outline-none placeholder:text-vx-muted"
          />
        </label>

        <div className="flex flex-col gap-3">
          <h2 className="font-serif text-[22px] font-medium leading-none text-vx-text">
            Inbox
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {TABS.map(([value, label]) => {
              const active = tab === value;
              return (
                <button
                  key={value}
                  onClick={() => onSelectTab(value)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-colors ${
                    active
                      ? "border-vx-accent bg-vx-accent-light text-vx-accent"
                      : "border-vx-border bg-vx-surface2 text-vx-muted hover:border-vx-border2 hover:text-vx-text2"
                  }`}
                >
                  {label}
                  <span
                    className={`inline-grid h-4 min-w-4 place-items-center rounded-full px-1 font-mono text-[9px] ${
                      active
                        ? "bg-vx-accent text-white dark:text-[#1a1814]"
                        : "bg-vx-surface3 text-vx-muted"
                    }`}
                  >
                    {counts[value]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-vx-border">
        {loading ? (
          <div className="loading">
            <div className="spinner" />
          </div>
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
                    <StatusBadge status={l.status} />
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
