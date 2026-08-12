// Funções de acesso ao Supabase reutilizáveis pelas telas.
// Espelham as queries do legacy (mesmas tabelas, ordenações e joins).
import { supabase } from "@/lib/supabase";
import { buscarTodasAsPaginas } from "@/lib/paginar";
import type {
  Lead,
  Conversa,
  Agendamento,
  AgendamentoComLead,
} from "@/types/db";

// Sobre o teto de 1.000 linhas do PostgREST e por que estas buscas são
// paginadas (e sempre com ordenação determinística), ver src/lib/paginar.ts.

// ── Leads ──
// Consumida por Visão geral (métricas e funil), Clientes, Conversas e Agenda —
// todas precisam do conjunto completo, senão a taxa de conversão e o funil
// passam a mentir. Hoje são ~375; o corte começaria em 1.000.
export async function getLeads(): Promise<Lead[]> {
  return buscarTodasAsPaginas<Lead>((de, ate) =>
    supabase
      .from("leads")
      .select("*")
      .order("criado_em", { ascending: false })
      .order("id", { ascending: false })
      .range(de, ate)
  );
}

// Atualiza campos de um lead (nao_lidas, ia_pausada, etc.). Lança em erro.
export async function updateLead(
  id: string,
  fields: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from("leads").update(fields).eq("id", id);
  if (error) throw error;
}

// (insertLead saiu: o cadastro manual passou a montar a linha inteira em
// src/lib/lead-form.ts → paraLinha, com 17 campos. Manter um helper de 4
// campos ao lado convidaria a usar o errado.)

export async function getLeadById(id: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Lead) ?? null;
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
  // Ordem CRESCENTE: o corte descartaria os agendamentos mais distantes, e
  // como a redução pega a 1ª ocorrência por lead, um cliente com muitas
  // marcações futuras poderia empurrar outros para fora da lista.
  const data = await buscarTodasAsPaginas<ProximaVisita>((de, ate) =>
    supabase
      .from("agendamentos")
      .select("lead_id, data_agendamento, servico")
      .gte("data_agendamento", nowIso)
      .neq("status", "cancelado")
      .order("data_agendamento", { ascending: true })
      .order("id", { ascending: true })
      .range(de, ate)
  );

  const vistos = new Set<string>();
  const proximas: ProximaVisita[] = [];
  for (const a of data) {
    if (!a.lead_id || vistos.has(a.lead_id)) continue; // 1ª ocorrência = mais próxima
    vistos.add(a.lead_id);
    proximas.push(a);
  }
  return proximas;
}

export async function getAgendamentos(): Promise<Agendamento[]> {
  return buscarTodasAsPaginas<Agendamento>((de, ate) =>
    supabase
      .from("agendamentos")
      .select("*")
      .order("data_agendamento", { ascending: true })
      .order("id", { ascending: true })
      .range(de, ate)
  );
}

// Ordem CRESCENTE: aqui o corte é o pior de todos, porque descartaria o
// FUTURO — a agenda perderia silenciosamente as marcações que ainda vão
// acontecer, que é justamente o que a tela existe para mostrar.
export async function getAgendamentosComLead(): Promise<AgendamentoComLead[]> {
  return buscarTodasAsPaginas<AgendamentoComLead>((de, ate) =>
    supabase
      .from("agendamentos")
      .select("*, leads(nome, telefone, foto_url)")
      .order("data_agendamento", { ascending: true })
      .order("id", { ascending: true })
      .range(de, ate)
  );
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
// (getConversas — `select *` ascendente sobre a tabela inteira — foi removida:
// não tinha consumidor e era o pior caso do teto de 1.000, devolveria as
// mensagens MAIS ANTIGAS de toda a base. O inbox usa a view abaixo e o chat
// usa getConversasByLead.)

// Última mensagem por lead (view no banco): 1 linha por lead. O inbox só
// precisa disso para preview e ordenação. Ordenada por `lead_id`, que é único
// nesta view (distinct on) — é o que torna a paginação estável.
export async function getUltimaConversaPorLead(): Promise<Conversa[]> {
  return buscarTodasAsPaginas<Conversa>((de, ate) =>
    supabase
      .from("conversa_ultima_por_lead")
      .select("*")
      .order("lead_id", { ascending: true })
      .range(de, ate)
  );
}

// Tamanho do lote do chat. O WhatsApp faz o mesmo: abre no fim da conversa e
// o histórico antigo vem sob demanda.
export const CONVERSAS_PAGINA = 50;

// Histórico do chat, do MAIS RECENTE para trás.
//
// O PostgREST devolve no máximo 1.000 linhas e NÃO sinaliza quando corta — sem
// erro, sem status diferente. Ordenar crescente sem limite, portanto, jogava
// fora exatamente o que interessa: o fim da conversa. Medido em produção: o
// lead com 1.075 mensagens parava em 29/07 17:17 e as 75 mais recentes (até
// 31/07 19:13) simplesmente não existiam para a tela.
//
// A busca é decrescente e o array volta INVERTIDO, então quem consome continua
// recebendo ordem cronológica e nada a jusante muda (separadores de dia,
// scroll, bolha otimista).
export async function getConversasByLead(
  leadId: string,
  opcoes: { antesDe?: string; limite?: number } = {}
): Promise<Conversa[]> {
  const { antesDe, limite = CONVERSAS_PAGINA } = opcoes;
  let q = supabase
    .from("conversas")
    .select("*")
    .eq("lead_id", leadId)
    .order("enviado_em", { ascending: false })
    .limit(limite);
  // Cursor: continua a partir da mais antiga já carregada. Por cursor, e não
  // por deslocamento (.range), o custo não cresce conforme o usuário sobe.
  //
  // `lte` e não `lt`: existem mensagens com o MESMO `enviado_em` dentro do
  // mesmo lead (2 pares hoje). Com `lt`, uma página que terminasse exatamente
  // numa colisão perderia a gêmea para sempre. Com `lte` a linha do cursor
  // volta repetida e quem monta a lista descarta por `id`.
  if (antesDe) q = q.lte("enviado_em", antesDe);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as Conversa[]).reverse();
}

// ── Escala (para atribuir quem atendeu) ──
// `profissionais` e `profissional_horarios` têm policy para `authenticated`,
// então o navegador lê direto. São 4 e 23 linhas — limite explícito por regra
// da casa, não por necessidade.
export async function getEscala(): Promise<{
  profissionais: { id: string; nome: string; ativo: boolean | null }[];
  horarios: {
    profissional_id: string;
    dia_semana: number;
    hora_inicio: string;
    hora_fim: string;
  }[];
}> {
  const [p, h] = await Promise.all([
    supabase.from("profissionais").select("id, nome, ativo").order("nome").limit(200),
    supabase
      .from("profissional_horarios")
      .select("profissional_id, dia_semana, hora_inicio, hora_fim")
      .order("dia_semana")
      .limit(1000),
  ]);
  if (p.error) throw p.error;
  if (h.error) throw h.error;
  return {
    profissionais: (p.data ?? []) as { id: string; nome: string; ativo: boolean | null }[],
    horarios: (h.data ?? []) as {
      profissional_id: string;
      dia_semana: number;
      hora_inicio: string;
      hora_fim: string;
    }[],
  };
}
