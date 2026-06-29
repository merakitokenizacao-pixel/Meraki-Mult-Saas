"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { formatDayLabel, getTemp, isLeadPaused } from "@/lib/conversa";
import type { Conversa, Lead } from "@/types/db";
import type { PendingMsg } from "@/components/conversas/conversas";

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatPanel({
  lead,
  messages,
  chatLoading,
  pendingMsgs,
  sending,
  onSend,
  onToggleIA,
}: {
  lead: Lead | null;
  messages: Conversa[];
  chatLoading: boolean;
  pendingMsgs: PendingMsg[];
  sending: boolean;
  onSend: (text: string) => Promise<boolean>;
  onToggleIA: () => void;
}) {
  const [input, setInput] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);

  // Rola para o fim sempre que as mensagens/pendências mudam.
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

  // Monta as mensagens com separadores de dia.
  const blocks: React.ReactNode[] = [];
  let lastDay = "";
  messages.forEach((m) => {
    const d = new Date(m.enviado_em);
    const dayKey = d.toDateString();
    if (dayKey !== lastDay) {
      blocks.push(
        <div className="msg-date-sep" key={"sep-" + m.id}>
          {formatDayLabel(d)}
        </div>
      );
      lastDay = dayKey;
    }
    const isAgente = m.origem === "agente";
    const isHumano = m.origem === "humano";
    const ladoDireita = isAgente || isHumano;
    blocks.push(
      <div
        key={m.id}
        className={`msg-bubble ${ladoDireita ? "agente" : "cliente"}${
          isHumano ? " humano" : ""
        }`}
      >
        <div className="msg-content">
          {isAgente && <div className="msg-sender-tag">🤖 A VoraX</div>}
          {isHumano && (
            <div className="msg-sender-tag" style={{ color: "var(--vx-purple)" }}>
              👤 Você
            </div>
          )}
          <div className="msg-text">{m.mensagem}</div>
          <div className="msg-time">{hhmm(m.enviado_em)}</div>
        </div>
      </div>
    );
  });

  return (
    <div className="conversa-chat">
      <div className="conversa-chat-header">
        <div className="conversa-chat-identity">
          {lead && <Avatar nome={lead.nome} fotoUrl={lead.foto_url} size={40} fontSize={12} />}
          <div className="conversa-chat-meta">
            <div
              className="conversa-chat-name"
              style={!lead ? { color: "var(--vx-muted)" } : undefined}
            >
              {lead ? lead.nome || lead.telefone || "—" : "Selecione um cliente"}
            </div>
            {lead && (
              <div className="conversa-chat-substrip">
                <span>{lead.telefone || "—"}</span>
                {temp?.label && (
                  <>
                    <span className="dot-sep">·</span>
                    <span className="temp-inline">🔥 {temp.label}</span>
                    {temp.score != null && (
                      <>
                        <span className="dot-sep">·</span>
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
          <div className="conversa-chat-actions">
            <button
              className={`ia-toggle${paused ? " paused" : ""}`}
              onClick={onToggleIA}
            >
              <span className="ia-toggle-dot" />
              <span>{paused ? "IA PAUSADA" : "IA ATIVA"}</span>
            </button>
            <button className="chat-icon-btn" title="Opções">
              ⋮
            </button>
          </div>
        )}
      </div>

      <div className="conversa-chat-messages" ref={messagesRef}>
        {!lead ? (
          <div className="empty">
            <span className="empty-icon">💬</span>
            Selecione um cliente para ver o histórico
          </div>
        ) : chatLoading ? (
          <div className="loading">
            <div className="spinner" />
          </div>
        ) : messages.length === 0 && pendingMsgs.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">💬</span>
            Nenhuma mensagem ainda
          </div>
        ) : (
          <>
            {blocks}
            {pendingMsgs.map((p) => (
              <div className="msg-bubble agente" key={p.id}>
                <div className="msg-content">
                  <div className="msg-sender-tag">👤 Você</div>
                  <div className="msg-text">{p.mensagem}</div>
                  <div className="msg-time">
                    <span
                      className="msg-status"
                      style={{
                        color:
                          p.status === "enviado"
                            ? "var(--vx-green)"
                            : p.status === "falhou"
                              ? "var(--vx-red)"
                              : undefined,
                      }}
                    >
                      {p.status === "enviado"
                        ? "enviado ✓"
                        : p.status === "falhou"
                          ? "falhou ⚠"
                          : "enviando…"}
                    </span>{" "}
                    · {hhmm(p.enviado_em)}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {lead && (
        <div className="conversa-composer-wrap">
          <div className="conversa-composer">
            <button className="composer-icon-btn" title="Anexar">
              📎
            </button>
            <input
              className="composer-input"
              type="text"
              placeholder="Digite uma mensagem…"
              value={input}
              disabled={sending}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button className="composer-icon-btn" title="Gravar áudio">
              🎤
            </button>
            <button
              className="composer-send"
              title="Enviar"
              onClick={handleSend}
              style={sending ? { opacity: 0.5, pointerEvents: "none" } : undefined}
            >
              ➤
            </button>
          </div>
          <div className="composer-footnote">
            {paused ? (
              <>
                <span>👤</span>
                <span>
                  {lead.pausada_por === "cliente"
                    ? "O cliente pediu atendimento humano."
                    : "Você está atendendo este cliente."}
                </span>
                <span className="link" onClick={onToggleIA}>
                  Retomar a VoraX.
                </span>
              </>
            ) : (
              <>
                <span>🔒</span>
                <span>A VoraX está gerenciando esta conversa automaticamente.</span>
                <span className="link" onClick={onToggleIA}>
                  Clique para pausar e assumir.
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
