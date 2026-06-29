"use client";

import { Avatar } from "@/components/avatar";
import { StatusBadge } from "@/components/status-badge";
import { getRelativeTime } from "@/lib/format";
import {
  getChannelIcon,
  getLastMsgPreview,
  lastMsgInfo,
} from "@/lib/conversa";
import type { Conversa, Lead } from "@/types/db";

export type InboxTab = "tudo" | "ia" | "humano" | "inativo";

const TABS: ReadonlyArray<[InboxTab, string]> = [
  ["tudo", "TUDO"],
  ["ia", "IA"],
  ["humano", "HUMANO"],
  ["inativo", "INATIVO"],
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
  return (
    <div className="conversa-sidebar">
      <div className="conversa-sidebar-header">
        <div className="conversa-sidebar-top">
          <div className="conversa-sidebar-title">Inbox</div>
          <button className="conversa-filter-btn" title="Filtros avançados">
            ☰
          </button>
        </div>
        <div className="conversa-tabs">
          {TABS.map(([value, label]) => (
            <div
              key={value}
              className={`conversa-tab${tab === value ? " active" : ""}`}
              onClick={() => onSelectTab(value)}
            >
              <span className="conversa-tab-label">{label}</span>
              <span className="conversa-tab-count">({counts[value]})</span>
            </div>
          ))}
        </div>
      </div>

      <div className="conversa-sidebar-list">
        {loading ? (
          <div className="loading">
            <div className="spinner" />
          </div>
        ) : leads.length === 0 ? (
          <div className="empty">Nenhum cliente</div>
        ) : (
          leads.map((l) => {
            const preview = getLastMsgPreview(l, conversas);
            const { raw } = lastMsgInfo(l, conversas);
            const unread = Number(l.nao_lidas) || 0;
            const showUnread = unread > 0 && currentLeadId !== l.id;
            const channel = getChannelIcon(l);
            return (
              <div
                key={l.id}
                className={`conversa-contact${currentLeadId === l.id ? " active" : ""}`}
                onClick={() => onSelectLead(l.id)}
              >
                <div className="conversa-contact-avatar">
                  <Avatar nome={l.nome} fotoUrl={l.foto_url} size={40} fontSize={11} />
                </div>
                <div className="conversa-contact-info">
                  <div className="conversa-contact-row1">
                    <div className="conversa-contact-name">
                      {l.nome || l.telefone || "—"}
                    </div>
                    <div className="conversa-contact-time">
                      {getRelativeTime(raw)}
                    </div>
                  </div>
                  <div className="conversa-contact-row2">
                    <StatusBadge status={l.status} />
                    <span className="conversa-channel-icon" title={channel.title}>
                      {channel.glyph}
                    </span>
                  </div>
                  <div className="conversa-contact-preview">{preview.text}</div>
                </div>
                {showUnread && <div className="conversa-unread">{unread}</div>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
