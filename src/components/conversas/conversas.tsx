"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getAgendamentos,
  getConversas,
  getConversasByLead,
  getLeadById,
  getLeads,
  updateLead,
} from "@/lib/queries";
import { isLeadInativo, isLeadPaused, lastMsgInfo } from "@/lib/conversa";
import { enviarMensagemWebhook } from "@/lib/n8n";
import { showToast } from "@/lib/toast";
import { InboxList, type InboxTab } from "@/components/conversas/inbox-list";
import { ChatPanel } from "@/components/conversas/chat-panel";
import { DetailsPanel } from "@/components/conversas/details-panel";
import type { Agendamento, Conversa, Lead } from "@/types/db";

export type PendingMsg = {
  id: string;
  mensagem: string;
  enviado_em: string;
  status: "enviando" | "enviado" | "falhou";
};

export function Conversas() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<InboxTab>("tudo");
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Conversa[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingMsgs, setPendingMsgs] = useState<PendingMsg[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [l, a, c] = await Promise.all([
          getLeads(),
          getAgendamentos(),
          getConversas(),
        ]);
        setLeads(l);
        setAgendamentos(a);
        setConversas(c);
      } catch {
        showToast("Erro ao carregar as conversas.", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const currentLead = useMemo(
    () => leads.find((l) => l.id === currentLeadId) ?? null,
    [leads, currentLeadId]
  );

  const counts = useMemo<Record<InboxTab, number>>(() => {
    const humano = leads.filter(isLeadPaused).length;
    const inativo = leads.filter(isLeadInativo).length;
    const ia = leads.filter((l) => !isLeadPaused(l) && !isLeadInativo(l)).length;
    return { tudo: leads.length, ia, humano, inativo };
  }, [leads]);

  // filterByInboxTab + ordenação por última mensagem (estilo WhatsApp).
  const orderedLeads = useMemo(() => {
    let f = leads;
    if (tab === "ia") f = leads.filter((l) => !isLeadPaused(l) && !isLeadInativo(l));
    else if (tab === "humano") f = leads.filter(isLeadPaused);
    else if (tab === "inativo") f = leads.filter(isLeadInativo);
    return [...f].sort(
      (a, b) => lastMsgInfo(b, conversas).ts - lastMsgInfo(a, conversas).ts
    );
  }, [leads, tab, conversas]);

  async function openConversa(leadId: string) {
    setCurrentLeadId(leadId);
    setPendingMsgs([]);

    // Zera nao_lidas no cache local e persiste (o n8n volta a incrementar).
    const target = leads.find((l) => l.id === leadId);
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, nao_lidas: 0 } : l))
    );
    if (target && (Number(target.nao_lidas) || 0) > 0) {
      updateLead(leadId, { nao_lidas: 0 }).catch(() => {});
    }

    setChatLoading(true);
    setChatMessages([]);
    try {
      const [fresh, msgs] = await Promise.all([
        getLeadById(leadId),
        getConversasByLead(leadId),
      ]);
      if (fresh) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, ...fresh } : l))
        );
      }
      setChatMessages(msgs);
    } catch {
      /* silencioso, como o legacy */
    } finally {
      setChatLoading(false);
    }
  }

  async function toggleIA() {
    if (!currentLead) return;
    const novoEstado = !isLeadPaused(currentLead);
    const fields = novoEstado
      ? {
          ia_pausada: true,
          pausada_em: new Date().toISOString(),
          pausada_por: "humano",
          motivo_pausa: "pausada manualmente via CRM",
        }
      : { ia_pausada: false, pausada_em: null, pausada_por: null, motivo_pausa: null };
    try {
      await updateLead(currentLead.id, fields);
      setLeads((prev) =>
        prev.map((l) => (l.id === currentLead.id ? ({ ...l, ...fields } as Lead) : l))
      );
      showToast(
        novoEstado
          ? "IA pausada — você está no controle"
          : "IA retomada — A VoraX está gerenciando",
        "info"
      );
    } catch {
      showToast(
        "Erro ao " + (novoEstado ? "pausar" : "retomar") + " IA.",
        "error"
      );
    }
  }

  async function enviarMensagem(text: string): Promise<boolean> {
    const mensagem = text.trim();
    if (!mensagem) return false;
    if (!currentLead) {
      showToast("Selecione uma conversa primeiro", "error");
      return false;
    }
    if (!currentLead.telefone) {
      showToast("Lead sem telefone cadastrado", "error");
      return false;
    }

    const tempId = "tmp-" + Date.now();
    setPendingMsgs((prev) => [
      ...prev,
      { id: tempId, mensagem, enviado_em: new Date().toISOString(), status: "enviando" },
    ]);
    setSending(true);

    try {
      // Auto-pausa a IA antes de enviar (evita IA + humano respondendo juntos).
      if (!isLeadPaused(currentLead)) {
        const pauseFields = {
          ia_pausada: true,
          pausada_em: new Date().toISOString(),
          pausada_por: "humano",
          motivo_pausa: "pausada automaticamente ao enviar mensagem pelo CRM",
        };
        await updateLead(currentLead.id, pauseFields);
        setLeads((prev) =>
          prev.map((l) =>
            l.id === currentLead.id ? ({ ...l, ...pauseFields } as Lead) : l
          )
        );
      }

      await enviarMensagemWebhook({
        lead_id: currentLead.id,
        telefone: currentLead.telefone,
        mensagem,
      });

      setPendingMsgs((prev) =>
        prev.map((p) => (p.id === tempId ? { ...p, status: "enviado" } : p))
      );
      setConversas((prev) => [
        ...prev,
        {
          id: tempId,
          lead_id: currentLead.id,
          mensagem,
          origem: "humano",
          enviado_em: new Date().toISOString(),
        },
      ]);
      return true;
    } catch (err) {
      setPendingMsgs((prev) =>
        prev.map((p) => (p.id === tempId ? { ...p, status: "falhou" } : p))
      );
      showToast("Erro ao enviar: " + (err as Error).message, "error");
      return false;
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page-fade">
      <div className="conversa-layout">
        <InboxList
          leads={orderedLeads}
          conversas={conversas}
          tab={tab}
          counts={counts}
          currentLeadId={currentLeadId}
          loading={loading}
          onSelectTab={setTab}
          onSelectLead={openConversa}
        />
        <ChatPanel
          lead={currentLead}
          messages={chatMessages}
          chatLoading={chatLoading}
          pendingMsgs={pendingMsgs}
          sending={sending}
          onSend={enviarMensagem}
          onToggleIA={toggleIA}
        />
        <DetailsPanel lead={currentLead} agendamentos={agendamentos} />
      </div>
    </div>
  );
}
