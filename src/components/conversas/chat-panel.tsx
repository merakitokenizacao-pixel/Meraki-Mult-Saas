"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Lock,
  MessageCircle,
  Mic,
  MoreVertical,
  PanelRight,
  Paperclip,
  Send,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { formatDayLabel, getTemp, isLeadPaused } from "@/lib/conversa";
import { ChatSkeleton } from "@/components/conversas/skeletons";
import type { Conversa, Lead } from "@/types/db";
import type { PendingMsg } from "@/components/conversas/conversas";

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Estilo da bolha por origem (cliente à esquerda; IA/humano à direita).
function bubbleClasses(kind: "cliente" | "agente" | "humano") {
  const base =
    "border px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words";
  if (kind === "cliente")
    return `${base} rounded-[16px] rounded-tl-[4px] border-vx-border bg-vx-surface text-vx-text`;
  if (kind === "humano")
    return `${base} rounded-[16px] rounded-tr-[4px] border-vx-purple bg-vx-purple-bg text-vx-purple`;
  return `${base} rounded-[16px] rounded-tr-[4px] border-transparent bg-vx-accent text-white dark:border-vx-accent dark:bg-vx-accent-light dark:text-vx-accent`;
}

export function ChatPanel({
  lead,
  messages,
  chatLoading,
  pendingMsgs,
  sending,
  panelOpen,
  onSend,
  onToggleIA,
  onTogglePanel,
  onBack,
}: {
  lead: Lead | null;
  messages: Conversa[];
  chatLoading: boolean;
  pendingMsgs: PendingMsg[];
  sending: boolean;
  panelOpen: boolean;
  onSend: (text: string) => Promise<boolean>;
  onToggleIA: () => void;
  onTogglePanel: () => void;
  onBack: () => void;
}) {
  const [input, setInput] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pendingMsgs, lead?.id]);

  async function handleSend() {
    const ok = await onSend(input);
    if (ok) setInput("");
  }

  const paused = isLeadPaused(lead);
  const temp = lead ? getTemp(lead) : null;

  // Mensagens com separadores de dia.
  const blocks: React.ReactNode[] = [];
  let lastDay = "";
  messages.forEach((m) => {
    const d = new Date(m.enviado_em);
    const dayKey = d.toDateString();
    if (dayKey !== lastDay) {
      blocks.push(
        <div
          key={"sep-" + m.id}
          className="my-3 self-center rounded-full bg-vx-surface2 px-3.5 py-1.5 font-mono text-[10px] tracking-wide text-vx-muted"
        >
          {formatDayLabel(d)}
        </div>
      );
      lastDay = dayKey;
    }
    const isAgente = m.origem === "agente";
    const isHumano = m.origem === "humano";
    const kind = isHumano ? "humano" : isAgente ? "agente" : "cliente";
    const right = kind !== "cliente";
    blocks.push(
      <div
        key={m.id}
        className={`flex max-w-[65%] flex-col ${right ? "items-end self-end" : "items-start self-start"}`}
      >
        {isAgente && (
          <div className="mb-1 flex items-center gap-1 text-[9px] font-bold tracking-wider text-vx-accent">
            <Bot size={12} /> A VoraX
          </div>
        )}
        {isHumano && (
          <div className="mb-1 flex items-center gap-1 text-[9px] font-bold tracking-wider text-vx-purple">
            <UserRound size={12} /> Você
          </div>
        )}
        <div className={bubbleClasses(kind)}>{m.mensagem}</div>
        <div
          className={`mt-1 px-0.5 font-mono text-[10px] text-vx-muted ${right ? "text-right" : ""}`}
        >
          {hhmm(m.enviado_em)}
        </div>
      </div>
    );
  });

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-vx-border bg-vx-bg">
      {/* Header (~64px) */}
      <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-vx-border bg-vx-surface px-6">
        <div className="flex min-w-0 items-center gap-3">
          {lead && (
            <button
              onClick={onBack}
              aria-label="Voltar"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-vx-muted transition-colors hover:bg-vx-surface2 hover:text-vx-text lg:hidden"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          {lead && (
            <Avatar nome={lead.nome} fotoUrl={lead.foto_url} size={40} fontSize={12} />
          )}
          <div className="min-w-0">
            <div
              className={`truncate font-serif text-[18px] font-medium leading-tight ${lead ? "text-vx-text" : "text-vx-muted"}`}
            >
              {lead ? lead.nome || lead.telefone || "—" : "Selecione um cliente"}
            </div>
            {lead && (
              <div className="flex items-center gap-2 truncate font-mono text-[11px] text-vx-muted">
                <span>{lead.telefone || "—"}</span>
                {temp?.label && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="font-sans font-semibold text-vx-red">
                      🔥 {temp.label}
                    </span>
                    {temp.score != null && (
                      <>
                        <span className="opacity-40">·</span>
                        <span>{temp.score}</span>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {lead && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onToggleIA}
              aria-label={paused ? "Retomar a IA" : "Pausar a IA"}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10.5px] font-bold tracking-wide transition-colors ${
                paused
                  ? "border-vx-border2 bg-vx-surface2 text-vx-muted hover:text-vx-text"
                  : "border-vx-accent bg-vx-accent-light text-vx-accent hover:bg-vx-accent hover:text-white dark:hover:text-[#1a1814]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full bg-current ${paused ? "" : "animate-[pulse-dot_2s_ease-in-out_infinite]"}`}
              />
              {paused ? "IA PAUSADA" : "IA ATIVA"}
            </button>
            <button
              onClick={onTogglePanel}
              aria-label={panelOpen ? "Fechar detalhes" : "Abrir detalhes"}
              aria-pressed={panelOpen}
              title="Detalhes do cliente"
              className={`grid h-8 w-8 place-items-center rounded-lg border transition-colors ${
                panelOpen
                  ? "border-vx-accent bg-vx-accent-light text-vx-accent"
                  : "border-vx-border bg-vx-surface2 text-vx-muted hover:border-vx-accent hover:text-vx-text"
              }`}
            >
              <PanelRight size={16} />
            </button>
            <button
              title="Opções"
              aria-label="Opções"
              className="grid h-8 w-8 place-items-center rounded-lg border border-vx-border bg-vx-surface2 text-vx-muted transition-colors hover:border-vx-accent hover:text-vx-text"
            >
              <MoreVertical size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Corpo */}
      <div
        ref={messagesRef}
        className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-8 py-6"
      >
        {!lead ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-vx-border bg-vx-surface2">
              <MessageCircle
                size={32}
                strokeWidth={1.5}
                className="text-vx-accent opacity-70"
              />
            </div>
            <div>
              <div className="font-serif text-[26px] font-medium text-vx-text">
                Conversas
              </div>
              <p className="mx-auto mt-1 max-w-xs text-[13px] text-vx-muted">
                Selecione uma conversa à esquerda para ver o histórico e responder.
              </p>
            </div>
          </div>
        ) : chatLoading ? (
          <ChatSkeleton />
        ) : messages.length === 0 && pendingMsgs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-vx-muted">
            <MessageCircle size={28} strokeWidth={1.5} className="opacity-30" />
            <p className="text-[13px]">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          <>
            {blocks}
            {pendingMsgs.map((p) => (
              <div
                key={p.id}
                className="flex max-w-[65%] flex-col items-end self-end"
              >
                <div className="mb-1 flex items-center gap-1 text-[9px] font-bold tracking-wider text-vx-accent">
                  <UserRound size={12} /> Você
                </div>
                <div className={bubbleClasses("agente")}>{p.mensagem}</div>
                <div className="mt-1 px-0.5 text-right font-mono text-[10px]">
                  <span
                    className={
                      p.status === "enviado"
                        ? "text-vx-green"
                        : p.status === "falhou"
                          ? "text-vx-red"
                          : "text-vx-muted"
                    }
                  >
                    {p.status === "enviado"
                      ? "enviado ✓"
                      : p.status === "falhou"
                        ? "falhou ⚠"
                        : "enviando…"}
                  </span>
                  <span className="text-vx-muted"> · {hhmm(p.enviado_em)}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Composer */}
      {lead && (
        <div className="shrink-0 border-t border-vx-border bg-vx-surface px-6 pb-3 pt-4">
          <div className="flex items-center gap-2">
            <button
              aria-label="Anexar"
              title="Anexar"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-vx-muted transition-colors hover:bg-vx-surface2 hover:text-vx-text"
            >
              <Paperclip size={18} />
            </button>
            <input
              type="text"
              placeholder="Digite uma mensagem…"
              aria-label="Mensagem"
              value={input}
              disabled={sending}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="w-full rounded-full border border-vx-border bg-vx-surface2 px-4 py-2.5 text-[13.5px] text-vx-text outline-none transition-colors placeholder:text-vx-muted focus:border-vx-accent focus:bg-vx-surface"
            />
            <button
              aria-label="Gravar áudio"
              title="Gravar áudio"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-vx-muted transition-colors hover:bg-vx-surface2 hover:text-vx-text"
            >
              <Mic size={18} />
            </button>
            <button
              aria-label="Enviar"
              title="Enviar"
              onClick={handleSend}
              disabled={sending}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-vx-accent text-white transition hover:opacity-85 disabled:pointer-events-none disabled:opacity-50 dark:text-[#1a1814]"
            >
              <Send size={16} />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-center text-[11px] text-vx-muted">
            {paused ? (
              <>
                <UserRound size={13} className="text-vx-muted" />
                <span>
                  {lead.pausada_por === "cliente"
                    ? "O cliente pediu atendimento humano."
                    : "Você está atendendo este cliente."}
                </span>
                <button
                  onClick={onToggleIA}
                  className="font-semibold text-vx-accent hover:underline"
                >
                  Retomar a VoraX.
                </button>
              </>
            ) : (
              <>
                <Lock size={13} className="text-vx-muted" />
                <span>A VoraX está gerenciando esta conversa automaticamente.</span>
                <button
                  onClick={onToggleIA}
                  className="font-semibold text-vx-accent hover:underline"
                >
                  Clique para pausar e assumir.
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
