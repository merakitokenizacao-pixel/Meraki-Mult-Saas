"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  CONVERSAS_PAGINA,
  getAgendaSlots,
  getAgendamentos,
  getAgendamentosComLead,
  getConversasByLead,
  getEscala,
  getLeads,
  getProximasVisitas,
  getUltimaConversaPorLead,
} from "@/lib/queries";
import type { PromocaoPreco, ServicoCatalogo } from "@/lib/servicos";

// Hooks de dados com cache (React Query). Envolvem as queries do Supabase
// sem alterá-las — só adicionam cache/dedupe/estado de loading e erro.
// queryKeys dos agendamentos compartilham o prefixo ["agendamentos"], então
// invalidar esse prefixo atualiza tanto a lista simples quanto a com join.
// `enabled` existe para quem só precisa dos leads sob demanda (a Agenda, que
// usa a lista apenas no combobox de um modal que pode nem abrir). A queryKey é
// a mesma das outras telas, então quando o cache já está quente o modal abre
// preenchido na hora — desabilitado não significa vazio, significa "não busque".
export function useLeads(opcoes: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["leads"],
    queryFn: getLeads,
    enabled: opcoes.enabled ?? true,
  });
}

export function useAgendamentos() {
  return useQuery({ queryKey: ["agendamentos"], queryFn: getAgendamentos });
}

export function useAgendamentosComLead() {
  return useQuery({
    queryKey: ["agendamentos", "com-lead"],
    queryFn: getAgendamentosComLead,
  });
}

// Próxima visita futura por lead (derivada de agendamentos). Compartilha o
// prefixo ["agendamentos"], então invalidar agendamentos também a atualiza.
export function useProximasVisitas() {
  return useQuery({
    queryKey: ["agendamentos", "proximas-visitas"],
    queryFn: getProximasVisitas,
  });
}

// Disponibilidade da agenda vinda do BANCO (capacidade derivada da escala das
// profissionais). Compartilha o prefixo ["agendamentos"], então marcar/cancelar
// atualiza a grade; e a key inclui o período visível.
export function useAgendaSlots(de: string, ate: string) {
  return useQuery({
    queryKey: ["agendamentos", "slots", de, ate],
    queryFn: () => getAgendaSlots(de, ate),
    enabled: Boolean(de && ate),
  });
}

// Inbox: usa a última mensagem por lead (view), não todas as mensagens.
// queryKey ['conversas'] mantida (push otimista e realtime já usam essa key).
export function useConversas() {
  return useQuery({
    queryKey: ["conversas"],
    queryFn: getUltimaConversaPorLead,
  });
}

// Histórico do chat aberto, em lotes de 50 do mais recente para trás — como o
// WhatsApp: abre no fim da conversa e o antigo vem quando o usuário sobe.
//
// Compartilha o prefixo ["conversas"], então o realtime alcança esta query e a
// conversa na tela se atualiza sozinha.
//
// Paginação por CURSOR (o `enviado_em` da mensagem mais antiga já carregada),
// não por deslocamento: `.range(50,100)` obrigaria o banco a percorrer e jogar
// fora as linhas anteriores a cada página, ficando mais lento conforme o
// usuário sobe. Por cursor o custo é constante. E como o cursor é um instante,
// e não uma posição, mensagem nova chegando no fim não desloca as páginas
// antigas — por isso o refetch do realtime é seguro.
export function useConversasDoLead(leadId: string | null) {
  return useInfiniteQuery({
    queryKey: ["conversas", "lead", leadId],
    queryFn: ({ pageParam }) =>
      getConversasByLead(leadId as string, { antesDe: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultimaPagina, _todas, ultimoParam) => {
      // Lote menor que a página = chegamos no começo da conversa.
      if (ultimaPagina.length < CONVERSAS_PAGINA) return undefined;
      // A página vem em ordem crescente, então a mais antiga é a primeira.
      const cursor = ultimaPagina[0]?.enviado_em;
      // Trava: se o cursor não andou, parar em vez de repetir a mesma busca.
      if (!cursor || cursor === ultimoParam) return undefined;
      return cursor;
    },
    enabled: Boolean(leadId),
  });
}



// ── Catálogo de serviços ─────────────────────────────────────────────────────
// Vem de `documentos_lins` por rota de servidor: a tabela tem RLS ligada sem
// policy, então o cliente do navegador não lê direto.
// `staleTime` alto de propósito — é catálogo, muda quando a dona edita o
// documento, não a cada navegação.
export function useCatalogoServicos() {
  return useQuery({
    queryKey: ["catalogo-servicos"],
    queryFn: async () => {
      const r = await fetch("/api/painel/servicos");
      if (!r.ok) throw new Error("Não foi possível carregar os serviços");
      return (await r.json()) as {
        servicos: ServicoCatalogo[];
        promocoes: PromocaoPreco[];
      };
    },
    staleTime: 10 * 60 * 1000,
  });
}

// Escala das profissionais — muda raramente, então cache longo.
export function useEscala() {
  return useQuery({
    queryKey: ["escala"],
    queryFn: getEscala,
    staleTime: 10 * 60 * 1000,
  });
}

// Follow-ups com o resultado calculado pela view (converteu = o lead marcou
// em até 7 dias, sem cancelar). Rota de servidor: a view passa por service role.
export function useFollowUps() {
  return useQuery({
    queryKey: ["follow-ups"],
    queryFn: async () => {
      const r = await fetch("/api/painel/follow-ups");
      if (!r.ok) throw new Error("Não foi possível carregar os follow-ups");
      const j = (await r.json()) as {
        followups: Array<{
          lead_id: string;
          resultado: string | null;
          agendou_em: string | null;
        }>;
      };
      return j.followups ?? [];
    },
  });
}

/**
 * Ids dos leads que EM ALGUM MOMENTO escreveram para a clínica.
 *
 * Serve para separar quem chegou de quem só recebeu disparo. A dona mandou
 * mensagem para a lista antiga de contatos dela, e esses números entraram em
 * `leads` — sem este filtro o painel os conta como clientes captados e a taxa
 * de conversão despenca por causa do denominador.
 *
 * Vem de rota server-side porque a conta pede varrer `conversas` (6.500+
 * linhas), acima do teto de 1.000 do PostgREST.
 */
export function useLeadsQueResponderam() {
  return useQuery({
    queryKey: ["leads-ativos"],
    queryFn: async () => {
      const r = await fetch("/api/painel/leads-ativos");
      if (!r.ok) throw new Error("Não foi possível carregar quem respondeu");
      const j = (await r.json()) as { ids: string[] };
      return new Set(j.ids);
    },
    staleTime: 5 * 60 * 1000,
  });
}
