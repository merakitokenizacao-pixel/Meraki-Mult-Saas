import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { CamposPromocao, Promocao } from "@/lib/promocao";

// Acesso à tabela `promocoes` com service_role.
//
// ⚠️ Esta tabela é lida AO VIVO pela Laura a cada mensagem: toda escrita aqui
// muda o que ela oferece aos clientes na conversa seguinte. Sem deploy, sem
// cache.
//
// TENANT: service_role ignora a RLS, então o filtro por clínica é obrigação
// deste arquivo — sem ele, `select` devolveria as promoções de todas as
// clínicas e um `update` por id alteraria a promoção de outra. Toda função
// recebe o tenant JÁ VALIDADO por `resolverTenant()`; nenhuma delas aceita um
// id vindo do cliente sem esse passo antes.
//
// Nunca deletar fisicamente: promoção encerrada vira `ativa = false`. O
// histórico é o que permite medir campanha depois.

const COLUNAS =
  "id, titulo, descricao, procedimento, valor_promocional, condicao, dia_semana, valida_ate, ativa, anuncio_ativo, criado_em";

/** Teto explícito: sem ele o PostgREST corta em 1.000 sem avisar. */
const TETO = 500;

export async function listarPromocoes(tenant: string): Promise<Promocao[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("promocoes")
    .select(COLUNAS)
    .eq("tenant_id", tenant)
    .order("criado_em", { ascending: false })
    .limit(TETO);
  if (error) throw error;
  return (data ?? []) as Promocao[];
}

/** Quem já está marcada como "a do anúncio" (para avisar antes de duplicar). */
export async function promocaoNoAnuncio(
  tenant: string
): Promise<Promocao | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("promocoes")
    .select(COLUNAS)
    .eq("tenant_id", tenant)
    .eq("anuncio_ativo", true)
    .limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as Promocao) ?? null;
}

/**
 * Garante que só UMA promoção fique com `anuncio_ativo`. Duas marcadas
 * confundem o agente sobre qual oferta o anúncio está prometendo.
 *
 * O `eq("tenant_id")` aqui não é decoração: sem ele, publicar um anúncio numa
 * clínica desligaria o anúncio de todas as outras.
 */
async function desligarOutrosAnuncios(tenant: string, exceto: string) {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("promocoes")
    .update({ anuncio_ativo: false })
    .eq("tenant_id", tenant)
    .eq("anuncio_ativo", true)
    .neq("id", exceto);
  if (error) throw error;
}

export async function criarPromocao(
  tenant: string,
  c: CamposPromocao
): Promise<Promocao> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("promocoes")
    .insert({ ...c, tenant_id: tenant })
    .select(COLUNAS)
    .single();
  if (error) throw error;

  const nova = data as Promocao;
  if (nova.anuncio_ativo) await desligarOutrosAnuncios(tenant, nova.id);
  return nova;
}

export async function atualizarPromocao(
  tenant: string,
  id: string,
  c: CamposPromocao
): Promise<Promocao> {
  const db = getSupabaseAdmin();
  // `eq("tenant_id")` junto do `eq("id")`: o id vem da URL, ou seja, do
  // cliente. Sem o par, bastaria conhecer o uuid de uma promoção alheia para
  // reescrevê-la. Com o par, o update simplesmente não acha linha.
  const { data, error } = await db
    .from("promocoes")
    .update(c)
    .eq("id", id)
    .eq("tenant_id", tenant)
    .select(COLUNAS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("promocao_nao_encontrada");

  const p = data as Promocao;
  if (p.anuncio_ativo) await desligarOutrosAnuncios(tenant, p.id);
  return p;
}

/** Liga/desliga sem abrir o formulário (atalho da lista). */
export async function alternarAtiva(
  tenant: string,
  id: string,
  ativa: boolean
): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("promocoes")
    .update({ ativa })
    .eq("id", id)
    .eq("tenant_id", tenant);
  if (error) throw error;
}
