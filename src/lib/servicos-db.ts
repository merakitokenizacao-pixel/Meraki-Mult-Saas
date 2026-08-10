import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  montarPromocoes,
  montarServico,
  type PromocaoPreco,
  type ServicoCatalogo,
} from "@/lib/servicos";

// `documentos_lins` e `promocoes` têm RLS ligada e NENHUMA policy: o cliente do
// navegador recebe zero linhas. Só service role lê — daí a leitura ser
// server-side, como já acontece com as Promoções.
// O middleware exige sessão em /api/painel/* (401 sem login).

/** Só o que precisa ser lido; `conteudo` é grande e `embedding` é enorme. */
const COLUNAS = "id, nome, categoria, conteudo, tags";
/** A base tem 39 documentos; o teto é folga, não limite de negócio. */
const TETO = 500;

export async function listarCatalogoServicos(): Promise<ServicoCatalogo[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("documentos_lins")
    .select(COLUNAS)
    // "informacoes" é o documento de como chegar na clínica — não é serviço.
    .neq("categoria", "informacoes")
    .order("categoria", { ascending: true })
    .order("nome", { ascending: true })
    .limit(TETO);
  if (error) throw error;
  return (data ?? []).map(montarServico);
}

export async function listarPromocoesPreco(): Promise<PromocaoPreco[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("promocoes")
    .select("titulo, valor_promocional")
    .eq("ativa", true)
    .order("criado_em", { ascending: false })
    .limit(TETO);
  if (error) throw error;
  return montarPromocoes(data ?? []);
}
