"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getLeadById, updateLead } from "@/lib/queries";
import {
  useAgendamentos,
  useConversas,
  useConversasDoLead,
  useLeads,
} from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { matchesPeriod } from "@/lib/date";
import { isLeadInativo, isLeadPaused, lastMsgInfo } from "@/lib/conversa";
import { enviarMensagemWebhook } from "@/lib/n8n";
import { showToast } from "@/lib/toast";
import { InboxList, type InboxTab } from "@/components/conversas/inbox-list";
import { ChatPanel } from "@/components/conversas/chat-panel";
import { DetailsPanel } from "@/components/conversas/details-panel";
import type { Conversa, Lead } from "@/types/db";

export type PendingMsg = {
  id: string;
  mensagem: string;
  enviado_em: string;
  status: "enviando" | "enviado" | "falhou";
};

export function Conversas() {
  const qc = useQueryClient();
  const leadsQuery = useLeads();
  const conversasQuery = useConversas();
  const agendamentosQuery = useAgendamentos();
  const leads = leadsQuery.data ?? [];
  const conversas = conversasQuery.data ?? [];
  const agendamentos = agendamentosQuery.data ?? [];
  const loading = leadsQuery.isPending || conversasQuery.isPending;

  // Mutações otimistas escrevem direto no cache (mesmas keys das outras telas),
  // então a UI reflete na hora e a fonte de verdade continua única. Como as
  // ações já usam a forma updater `set(prev => ...)`, o corpo delas não muda.
  const setLeads = (fn: (prev: Lead[]) => Lead[]) =>
    qc.setQueryData<Lead[]>(["leads"], (prev) => fn(prev ?? []));
  const setConversas = (fn: (prev: Conversa[]) => Conversa[]) =>
    qc.setQueryData<Conversa[]>(["conversas"], (prev) => fn(prev ?? []));

  const [tab, setTab] = useState<InboxTab>("tudo");
  const [period, setPeriod] = useState("tudo");
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(null);
  const [pendingMsgs, setPendingMsgs] = useState<PendingMsg[]>([]);
  const [sending, setSending] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // O chat aberto também é cache (prefixo ["conversas"]), então o realtime o
  // atualiza junto com a lista. Antes era estado local carregado no clique: a
  // mensagem nova aparecia na lista e a conversa na tela ficava congelada.
  const chatQuery = useConversasDoLead(currentLeadId);
  const chatLoading = Boolean(currentLeadId) && chatQuery.isPending;

  // As páginas vêm da mais nova para a mais antiga, e cada uma já em ordem
  // crescente. Invertendo a ORDEM DAS PÁGINAS (não das mensagens) sai a
  // conversa inteira em ordem cronológica.
  //
  // O dedupe existe porque o cursor usa `lte`: a mensagem da borda volta
  // repetida na página seguinte (ver getConversasByLead).
  const chatMessages = useMemo(() => {
    const paginas = chatQuery.data?.pages ?? [];
    const vistos = new Set<string>();
    const ordenadas: Conversa[] = [];
    for (const msg of [...paginas].reverse().flat()) {
      if (vistos.has(msg.id)) continue;
      vistos.add(msg.id);
      ordenadas.push(msg);
    }
    return ordenadas;
  }, [chatQuery.data]);

  // Mensagem que chega na conversa ABERTA já está sendo lida. O n8n incrementa
  // `nao_lidas` sem saber o que está na tela do navegador — quem tem essa
  // informação é o front, então é ele que zera. Idempotente: só age quando o
  // contador está acima de zero, então não entra em laço com o refetch.
  useEffect(() => {
    if (!currentLeadId) return;
    const atual = leads.find((l) => l.id === currentLeadId);
    if (!atual || (Number(atual.nao_lidas) || 0) === 0) return;
    setLeads((prev) =>
      prev.map((l) => (l.id === currentLeadId ? { ...l, nao_lidas: 0 } : l))
    );
    updateLead(currentLeadId, { nao_lidas: 0 }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages, currentLeadId, leads]);

  // Some com a bolha otimista assim que a versão persistida chega pelo n8n —
  // senão a mensagem enviada apareceria duas vezes depois do refetch.
  useEffect(() => {
    setPendingMsgs((prev) => {
      if (prev.length === 0) return prev;
      const restantes = prev.filter(
        (p) =>
          !chatMessages.some(
            (m) => m.origem === "humano" && m.mensagem === p.mensagem
          )
      );
      return restantes.length === prev.length ? prev : restantes;
    });
  }, [chatMessages]);

  // Painel do cliente aberto por padrão em telas largas (>= 1440px).
  useEffect(() => {
    setPanelOpen(window.innerWidth >= 1440);
  }, []);

  // Gancho de realtime: quando o n8n/cliente grava em `conversas` ou `leads`,
  // invalida o cache e a lista atualiza sozinha. Fica inerte até habilitar
  // Realtime nessas tabelas no Supabase (publicação supabase_realtime).
  useEffect(() => {
    const channel = supabase
      .channel("conversas-crm")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversas" },
        (payload) => {
          // A lista (view de última mensagem por lead) sempre atualiza.
          qc.invalidateQueries({ queryKey: ["conversas"], exact: true });
          // O chat só do lead que recebeu a mensagem. Invalidar o prefixo
          // inteiro faria a conversa aberta refazer TODAS as páginas
          // carregadas a cada mensagem de qualquer cliente. Sem o lead_id
          // (ex.: delete sem replica identity) cai no prefixo, como antes.
          const linha = (payload.new ?? payload.old) as { lead_id?: string };
          qc.invalidateQueries({
            queryKey: linha?.lead_id
              ? ["conversas", "lead", linha.lead_id]
              : ["conversas"],
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => qc.invalidateQueries({ queryKey: ["leads"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

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

  // filterByInboxTab + filtro de período (por ÚLTIMA ATIVIDADE) + ordenação.
  const orderedLeads = useMemo(() => {
    let f = leads;
    if (tab === "ia") f = leads.filter((l) => !isLeadPaused(l) && !isLeadInativo(l));
    else if (tab === "humano") f = leads.filter(isLeadPaused);
    else if (tab === "inativo") f = leads.filter(isLeadInativo);
    if (period !== "tudo") {
      f = f.filter((l) =>
        matchesPeriod(lastMsgInfo(l, conversas).raw, period)
      );
    }
    return [...f].sort(
      (a, b) => lastMsgInfo(b, conversas).ts - lastMsgInfo(a, conversas).ts
    );
  }, [leads, tab, conversas, period]);

  // Abertura por URL: outras telas (ex.: Follow-ups) linkam para
  // /conversas?lead=<id> para abrir direto aquele cliente. Aditivo — só reage
  // ao parâmetro na primeira vez que ele aparece com os leads já carregados;
  // não interfere no realtime, na pausa da IA nem no envio.
  const searchParams = useSearchParams();
  const leadDaUrl = searchParams.get("lead");
  const urlJaAbriu = useRef<string | null>(null);
  useEffect(() => {
    if (!leadDaUrl || leads.length === 0) return;
    if (urlJaAbriu.current === leadDaUrl) return;
    if (leads.some((l) => l.id === leadDaUrl)) {
      urlJaAbriu.current = leadDaUrl;
      openConversa(leadDaUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadDaUrl, leads]);

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

    // As mensagens vêm do cache (useConversasDoLead reage ao currentLeadId).
    // Aqui só refrescamos o lead em si.
    try {
      const fresh = await getLeadById(leadId);
      if (fresh) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, ...fresh } : l))
        );
      }
    } catch {
      /* silencioso, como o legacy */
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
      <div
        className={`conversas-fill grid min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden bg-vx-surface ${
          panelOpen
            ? "lg:grid-cols-[340px_minmax(0,1fr)_360px]"
            : "lg:grid-cols-[340px_minmax(0,1fr)]"
        }`}
      >
        {/* Inbox — some no mobile quando uma conversa está aberta */}
        <div className={`min-h-0 ${currentLeadId ? "hidden lg:block" : "block"}`}>
          <InboxList
            leads={orderedLeads}
            conversas={conversas}
            tab={tab}
            counts={counts}
            period={period}
            currentLeadId={currentLeadId}
            loading={loading}
            onSelectTab={setTab}
            onSelectPeriod={setPeriod}
            onSelectLead={openConversa}
            onRefresh={() => {
              qc.invalidateQueries({ queryKey: ["conversas"] });
              qc.invalidateQueries({ queryKey: ["leads"] });
            }}
          />
        </div>

        {/* Chat — no mobile aparece só quando há conversa selecionada */}
        <div className={`min-h-0 ${currentLeadId ? "block" : "hidden lg:block"}`}>
          <ChatPanel
            lead={currentLead}
            messages={chatMessages}
            chatLoading={chatLoading}
            temMaisAntigas={Boolean(chatQuery.hasNextPage)}
            carregandoAntigas={chatQuery.isFetchingNextPage}
            onCarregarAntigas={() => chatQuery.fetchNextPage()}
            pendingMsgs={pendingMsgs}
            sending={sending}
            panelOpen={panelOpen}
            onSend={enviarMensagem}
            onToggleIA={toggleIA}
            onTogglePanel={() => setPanelOpen((o) => !o)}
            onBack={() => setCurrentLeadId(null)}
          />
        </div>

        {/* Painel do cliente — coluna no desktop */}
        {panelOpen && (
          <div className="hidden min-h-0 lg:block">
            <DetailsPanel
              lead={currentLead}
              agendamentos={agendamentos}
              loading={loading}
              onClose={() => setPanelOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Painel do cliente — drawer no mobile */}
      {panelOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setPanelOpen(false)}
          />
          <aside
            className="absolute right-0 top-0 h-full w-[85%] max-w-sm"
            style={{ boxShadow: "var(--vx-shadow-lg)" }}
          >
            <DetailsPanel
              lead={currentLead}
              agendamentos={agendamentos}
              loading={loading}
              onClose={() => setPanelOpen(false)}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
