"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAgendaSlots,
  getAgendamentos,
  getAgendamentosComLead,
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

