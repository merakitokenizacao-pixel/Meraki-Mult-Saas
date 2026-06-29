// Funções de acesso ao Supabase reutilizáveis pelas telas.
// Espelham as queries do legacy (mesmas tabelas, ordenações e joins).
import { supabase } from "@/lib/supabase";
import type {
  Lead,
  Conversa,
  Agendamento,
  AgendamentoComLead,
  Campanha,
} from "@/types/db";

// ── Leads ──
export async function getLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Lead[];
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Lead) ?? null;
}

// Subconjunto de colunas usado para montar o público de campanhas.
export type LeadParaCampanha = Pick<
  Lead,
  "id" | "nome" | "telefone" | "aceita_campanha" | "ultima_interacao" | "criado_em"
>;
export async function getLeadsParaCampanha(): Promise<LeadParaCampanha[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("id,nome,telefone,aceita_campanha,ultima_interacao,criado_em");
  if (error) throw error;
  return (data ?? []) as LeadParaCampanha[];
}

// ── Agendamentos ──
export async function getAgendamentos(): Promise<Agendamento[]> {
  const { data, error } = await supabase.from("agendamentos").select("*");
  if (error) throw error;
  return (data ?? []) as Agendamento[];
}

export async function getAgendamentosComLead(): Promise<AgendamentoComLead[]> {
  const { data, error } = await supabase
    .from("agendamentos")
    .select("*, leads(nome, telefone, foto_url)")
    .order("data_agendamento", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AgendamentoComLead[];
}

export async function getAgendamentosByLead(
  leadId: string
): Promise<Agendamento[]> {
  const { data, error } = await supabase
    .from("agendamentos")
    .select("*")
    .eq("lead_id", leadId);
  if (error) throw error;
  return (data ?? []) as Agendamento[];
}

// ── Conversas ──
export async function getConversas(): Promise<Conversa[]> {
  const { data, error } = await supabase
    .from("conversas")
    .select("*")
    .order("enviado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Conversa[];
}

export async function getConversasByLead(leadId: string): Promise<Conversa[]> {
  const { data, error } = await supabase
    .from("conversas")
    .select("*")
    .eq("lead_id", leadId)
    .order("enviado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Conversa[];
}

// ── Campanhas ──
export async function getCampanhas(): Promise<Campanha[]> {
  const { data, error } = await supabase
    .from("campanhas")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Campanha[];
}
