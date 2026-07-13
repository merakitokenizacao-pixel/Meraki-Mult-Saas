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

// Atualiza campos de um lead (nao_lidas, ia_pausada, etc.). Lança em erro.
export async function updateLead(
  id: string,
  fields: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from("leads").update(fields).eq("id", id);
  if (error) throw error;
}

// Cadastro manual de lead. `telefone` é único (chave usada pelo n8n no upsert),
// então telefone repetido lança erro com code '23505' (tratado na UI).
export async function insertLead(fields: {
  nome: string;
  telefone: string;
  canal: string;
  status: string;
}): Promise<void> {
  const { error } = await supabase.from("leads").insert(fields);
  if (error) throw error;
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

// ── Disponibilidade da agenda (FONTE ÚNICA: o banco) ──
// A capacidade de cada horário é DERIVADA das profissionais e da escala delas
// (`profissionais` + `profissional_horarios` + `profissional_bloqueios`), via a
// função `agenda_slots`. É a MESMA função que o trigger usa e que as tools da
// Laura vão usar — então CRM e agente nunca divergem. Ver AGENTE.md.
//
// Isto SUBSTITUI o `lib/agenda-regras.ts` (grade hardcoded em TS), que virou
// só o fallback dentro do SQL, para o caso de a escala estar vazia.
export type SlotAgenda = {
  data: string; // "2026-07-24"
  hora: number; // 8..20
  capacidade: number;
  ocupadas: number;
  livres: number;
  fechado: boolean;
  codigo: string; // vocabulário do AGENTE.md (DISPONIVEL, ALMOCO_REPASSAR_HUMANO…)
  motivo: string;
};

export async function getAgendaSlots(
  de: string,
  ate: string
): Promise<SlotAgenda[]> {
  const { data, error } = await supabase.rpc("agenda_slots", {
    p_de: de,
    p_ate: ate,
  });
  if (error) throw error;
  return (data ?? []) as SlotAgenda[];
}

/** Checa UM horário (usado antes de salvar um agendamento). */
export async function checarHorario(
  inicioIso: string,
  duracaoMin = 60
): Promise<{
  ok: boolean;
  codigo: string;
  motivo: string;
  capacidade: number;
  ocupadas: number;
  livres: number;
}> {
  const { data, error } = await supabase.rpc("agenda_checar", {
    p_inicio: inicioIso,
    p_duracao_min: duracaoMin,
  });
  if (error) throw error;
  // A função devolve UMA linha.
  const r = (data ?? [])[0];
  return (
    r ?? {
      ok: false,
      codigo: "ERRO",
      motivo: "Não foi possível checar o horário.",
      capacidade: 0,
      ocupadas: 0,
      livres: 0,
    }
  );
}

// ── Agendamentos ──
// Próxima visita por lead: 1 query com o filtro no banco (>= agora, não
// cancelado), ordenada por data asc; reduzida a 1 linha por lead (a mais
// próxima). Sem N+1 por linha da lista. `now()` é o instante da requisição.
export type ProximaVisita = {
  lead_id: string;
  data_agendamento: string;
  servico: string | null;
};
export async function getProximasVisitas(): Promise<ProximaVisita[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("agendamentos")
    .select("lead_id, data_agendamento, servico")
    .gte("data_agendamento", nowIso)
    .neq("status", "cancelado")
    .order("data_agendamento", { ascending: true });
  if (error) throw error;

  const vistos = new Set<string>();
  const proximas: ProximaVisita[] = [];
  for (const a of (data ?? []) as ProximaVisita[]) {
    if (!a.lead_id || vistos.has(a.lead_id)) continue; // 1ª ocorrência = mais próxima
    vistos.add(a.lead_id);
    proximas.push(a);
  }
  return proximas;
}

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

export async function insertAgendamento(fields: {
  lead_id: string;
  servico: string;
  data_agendamento: string;
  status: string;
}): Promise<void> {
  const { error } = await supabase.from("agendamentos").insert(fields);
  if (error) throw error;
}

export async function updateAgendamentoStatus(
  id: string,
  status: string
): Promise<void> {
  const { error } = await supabase
    .from("agendamentos")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAgendamento(id: string): Promise<void> {
  const { error } = await supabase.from("agendamentos").delete().eq("id", id);
  if (error) throw error;
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

// Última mensagem por lead (view no banco). O inbox só precisa disso para
// preview/ordenação — evita puxar TODAS as mensagens (que o PostgREST corta
// em 1000 e quebraria previews conforme a base cresce).
export async function getUltimaConversaPorLead(): Promise<Conversa[]> {
  const { data, error } = await supabase
    .from("conversa_ultima_por_lead")
    .select("*");
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

export async function createCampanha(fields: {
  nome: string;
  mensagem: string;
  publico: string;
  status: string;
  total: number;
  enviados: number;
}): Promise<Campanha> {
  const { data, error } = await supabase
    .from("campanhas")
    .insert(fields)
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Falha ao criar campanha");
  return data as Campanha;
}

export async function insertCampanhaEnvios(
  lote: Array<{
    campanha_id: string;
    lead_id: string;
    telefone: string;
    nome: string | null;
    status: string;
  }>
): Promise<void> {
  const { error } = await supabase.from("campanha_envios").insert(lote);
  if (error) throw error;
}

export async function updateCampanhaTotal(
  id: string,
  total: number
): Promise<void> {
  const { error } = await supabase
    .from("campanhas")
    .update({ total })
    .eq("id", id);
  if (error) throw error;
}
