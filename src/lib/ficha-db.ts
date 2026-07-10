import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { calcularAlertas } from "@/lib/ficha";
import type { FichaRespostas, FichaStatus } from "@/types/db";

// ── Lado do painel (Entrega 2) ──────────────────────────────────────────────
// ATENÇÃO: estas funções servem a rotas SEM autenticação (o app não tem login).
// Elas expõem dado de saúde no mesmo nível que leads/conversas já ficam hoje.
// Dívida registrada para a Etapa 7 (login + RLS por clínica). Ver CLAUDE.md.

export type FichaPainel = {
  id: string;
  status: FichaStatus;
  tipo: string;
  alertas: string[];
  respostas: FichaRespostas | null;
  criadoEm: string;
  dataAgendamento: string | null;
};

/** Todas as fichas de um lead (mais recentes primeiro). Normalmente 0 ou 1. */
export async function getFichasByLead(leadId: string): Promise<FichaPainel[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("fichas_avaliacao")
    .select("id, status, tipo, alertas, respostas, criado_em, agendamento_id")
    .eq("lead_id", leadId)
    .order("criado_em", { ascending: false });

  if (error) throw error;

  const out: FichaPainel[] = [];
  for (const f of data ?? []) {
    out.push({
      id: f.id,
      status: f.status as FichaStatus,
      tipo: f.tipo,
      alertas: f.alertas ?? [],
      respostas: (f.respostas as FichaRespostas | null) ?? null,
      criadoEm: f.criado_em,
      dataAgendamento: await getDataAgendamento(f.agendamento_id),
    });
  }
  return out;
}

/** preenchida → revisada. Idempotente: revisar de novo afeta 0 linhas. */
export async function revisarFicha(fichaId: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("fichas_avaliacao")
    .update({ status: "revisada" })
    .eq("id", fichaId)
    .eq("status", "preenchida")
    .select("id");

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// Acesso à tabela `fichas_avaliacao` (RLS ligada, sem policies → service role).
// Regra de LGPD deste módulo: as RESPOSTAS nunca sobem para a página pública,
// e nada de conteúdo de ficha vai para log.

export type FichaPublica = {
  status: FichaStatus;
  nomeLead: string | null;
  dataAgendamento: string | null;
};

/** Ficha vista pela paciente: só o mínimo para renderizar. */
export async function getFichaPublica(
  token: string
): Promise<FichaPublica | null> {
  const db = getSupabaseAdmin();

  const { data: ficha, error } = await db
    .from("fichas_avaliacao")
    .select("status, lead_id, agendamento_id")
    .eq("id", token)
    .maybeSingle();

  if (error) throw error;
  if (!ficha) return null;

  return {
    status: ficha.status as FichaStatus,
    nomeLead: await getNomeLead(ficha.lead_id),
    dataAgendamento: await getDataAgendamento(ficha.agendamento_id),
  };
}

async function getNomeLead(leadId: string | null): Promise<string | null> {
  if (!leadId) return null;
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("leads")
    .select("nome")
    .eq("id", leadId)
    .maybeSingle();
  return data?.nome ?? null;
}

async function getDataAgendamento(
  agendamentoId: string | null
): Promise<string | null> {
  if (!agendamentoId) return null;
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("agendamentos")
    .select("data_agendamento")
    .eq("id", agendamentoId)
    .maybeSingle();
  return data?.data_agendamento ?? null;
}

export type SubmitResult =
  | { ok: true; dataAgendamento: string | null }
  | { ok: false; motivo: "nao_encontrada" | "ja_preenchida" | "erro" };

/**
 * Grava a ficha. O token vale UMA vez: o UPDATE exige `status = 'pendente'`,
 * então duas submissões simultâneas não se sobrescrevem — a segunda afeta 0
 * linhas e volta como `ja_preenchida`.
 */
export async function submitFicha(
  token: string,
  respostas: FichaRespostas
): Promise<SubmitResult> {
  const db = getSupabaseAdmin();

  const { data: atual, error: errBusca } = await db
    .from("fichas_avaliacao")
    .select("status, agendamento_id")
    .eq("id", token)
    .maybeSingle();

  if (errBusca) throw errBusca;
  if (!atual) return { ok: false, motivo: "nao_encontrada" };
  if (atual.status !== "pendente") return { ok: false, motivo: "ja_preenchida" };

  const { data: gravadas, error: errUpdate } = await db
    .from("fichas_avaliacao")
    .update({
      respostas,
      alertas: calcularAlertas(respostas),
      status: "preenchida",
      preenchida_em: new Date().toISOString(),
    })
    .eq("id", token)
    .eq("status", "pendente") // trava de corrida: token de uso único
    .select("id");

  if (errUpdate) throw errUpdate;
  if (!gravadas || gravadas.length === 0) {
    return { ok: false, motivo: "ja_preenchida" };
  }

  return {
    ok: true,
    dataAgendamento: await getDataAgendamento(atual.agendamento_id),
  };
}
