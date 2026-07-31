"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  CONVERSAS_PAGINA,
  getAgendaSlots,
  getAgendamentos,
  getAgendamentosComLead,
  getConversasByLead,
  getLeads,
  getProximasVisitas,
  getUltimaConversaPorLead,
} from "@/lib/queries";

// Hooks de dados com cache (React Query). Envolvem as queries do Supabase
// sem alterá-las — só adicionam cache/dedupe/estado de loading e erro.
// queryKeys dos agendamentos compartilham o prefixo ["agendamentos"], então
// invalidar esse prefixo atualiza tanto a lista simples quanto a com join.
export function useLeads() {
  return useQuery({ queryKey: ["leads"], queryFn: getLeads });
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

