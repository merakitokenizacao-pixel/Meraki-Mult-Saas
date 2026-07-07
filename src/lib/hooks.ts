"use client";

import { useQuery } from "@tanstack/react-query";
import { getAgendamentos, getLeads } from "@/lib/queries";

// Hooks de dados com cache (React Query). Envolvem as queries do Supabase
// sem alterá-las — só adicionam cache/dedupe/estado de loading e erro.
export function useLeads() {
  return useQuery({ queryKey: ["leads"], queryFn: getLeads });
}

export function useAgendamentos() {
  return useQuery({ queryKey: ["agendamentos"], queryFn: getAgendamentos });
}
