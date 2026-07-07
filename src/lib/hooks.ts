"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAgendamentos,
  getAgendamentosComLead,
  getCampanhas,
  getConversas,
  getLeads,
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

export function useConversas() {
  return useQuery({ queryKey: ["conversas"], queryFn: getConversas });
}

export function useCampanhas() {
  return useQuery({ queryKey: ["campanhas"], queryFn: getCampanhas });
}
