import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { CamposPromocao, Promocao } from "@/lib/promocao";

// Acesso à tabela `promocoes` (RLS ligada, sem policies → service role).
//
// ⚠️ Esta tabela é lida AO VIVO pela Laura a cada mensagem: toda escrita aqui
// muda o que ela oferece aos clientes na conversa seguinte. Sem deploy, sem
// cache. Ver AGENTE.md.
//
// Nunca deletar fisicamente: promoção encerrada vira `ativa = false`. O
// histórico é o que permite medir campanha depois.

const COLUNAS =
  "id, titulo, descricao, procedimento, valor_promocional, condicao, dia_semana, valida_ate, ativa, anuncio_ativo, criado_em";

export async function listarPromocoes(): Promise<Promocao[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("promocoes")
    .select(COLUNAS)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Promocao[];
}

/** Quem já está marcada como "a do anúncio" (para avisar antes de duplicar). */
export async function promocaoNoAnuncio(): Promise<Promocao | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("promocoes")
    .select(COLUNAS)
    .eq("anuncio_ativo", true)
    .limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as Promocao) ?? null;
}

/**
 * Garante que só UMA promoção fique com `anuncio_ativo`. Duas marcadas
 * confundem o agente sobre qual oferta o anúncio está prometendo.
 */
async function desligarOutrosAnuncios(exceto: string) {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("promocoes")
    .update({ anuncio_ativo: false })
    .eq("anuncio_ativo", true)
    .neq("id", exceto);
  if (error) throw error;
}

export async function criarPromocao(c: CamposPromocao): Promise<Promocao> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("promocoes")
    .insert(c)
    .select(COLUNAS)
    .single();
  if (error) throw error;

  const nova = data as Promocao;
  if (nova.anuncio_ativo) await desligarOutrosAnuncios(nova.id);
  return nova;
}

export async function atualizarPromocao(
  id: string,
  c: CamposPromocao
): Promise<Promocao> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("promocoes")
    .update(c)
    .eq("id", id)
    .select(COLUNAS)
    .single();
  if (error) throw error;

  const p = data as Promocao;
  if (p.anuncio_ativo) await desligarOutrosAnuncios(p.id);
  return p;
}

/** Liga/desliga sem abrir o formulário (atalho da lista). */
export async function alternarAtiva(id: string, ativa: boolean): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from("promocoes").update({ ativa }).eq("id", id);
  if (error) throw error;
}
