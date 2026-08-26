import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  montarPromocoes,
  montarServico,
  type PromocaoPreco,
  type ServicoCatalogo,
} from "@/lib/servicos";

// Leitura com service_role, que IGNORA a RLS — daí toda função exigir o
// tenant, JÁ VALIDADO por `resolverTenant()`. Catálogo e preço são por
// clínica: sem o filtro, uma veria a tabela de preços da outra.
//
// ⚠️ A tabela de catálogo mudou de nome no banco novo (`documentos_lins` →
// `documentos`) — ver CLAUDE.md, "O código ainda não conhece este banco".

/** Só o que precisa ser lido; `conteudo` é grande e `embedding` é enorme. */
const COLUNAS = "id, nome, categoria, conteudo, tags";
/** A base tem 39 documentos; o teto é folga, não limite de negócio. */
const TETO = 500;

export async function listarCatalogoServicos(
  tenant: string
): Promise<ServicoCatalogo[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("documentos_lins")
    .select(COLUNAS)
    .eq("tenant_id", tenant)
    // "informacoes" é o documento de como chegar na clínica — não é serviço.
    .neq("categoria", "informacoes")
    .order("categoria", { ascending: true })
    .order("nome", { ascending: true })
    .limit(TETO);
  if (error) throw error;
  return (data ?? []).map(montarServico);
}

export async function listarPromocoesPreco(
  tenant: string
): Promise<PromocaoPreco[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("promocoes")
    .select("titulo, valor_promocional")
    .eq("tenant_id", tenant)
    .eq("ativa", true)
    .order("criado_em", { ascending: false })
    .limit(TETO);
  if (error) throw error;
  return montarPromocoes(data ?? []);
}
