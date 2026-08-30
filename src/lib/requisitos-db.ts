import { supabase } from "@/lib/supabase";
import {
  limparChave,
  type CampoRequisito,
  type Requisito,
  type TipoCampo,
} from "@/lib/requisitos";

// Leitura e escrita da configuração de requisitos, pelo cliente do NAVEGADOR.
//
// TENANT: as quatro tabelas têm RLS `tenant_id IN (SELECT meus_tenants())`,
// então a leitura já vem filtrada — nada de `where tenant_id` manual aqui, que
// seria redundante e esconderia o vazamento se a policy quebrasse.
//
// Na ESCRITA o `tenant_id` é obrigatório (NOT NULL) e vem da clínica escolhida
// no seletor. Isso NÃO é o cliente escolhendo o tenant: o `WITH CHECK` da mesma
// policy recusa qualquer id que não seja desta conta. O navegador informa, o
// banco confere — que é a regra de ouro do projeto.

export interface RequisitoNaLista extends Requisito {
  procedimentos: number;
  perguntas: number;
}

export async function listarRequisitos(): Promise<RequisitoNaLista[]> {
  const [reqs, vinc, campos] = await Promise.all([
    supabase
      .from("requisitos")
      .select("id, nome, descricao, validade_dias, bloqueia, url_base, ativo")
      .order("nome"),
    supabase.from("requisito_procedimentos").select("requisito_id"),
    supabase.from("requisito_campos").select("requisito_id"),
  ]);
  if (reqs.error) throw reqs.error;
  if (vinc.error) throw vinc.error;
  if (campos.error) throw campos.error;

  const conta = (linhas: { requisito_id: string }[]) => {
    const m = new Map<string, number>();
    for (const l of linhas) m.set(l.requisito_id, (m.get(l.requisito_id) ?? 0) + 1);
    return m;
  };
  const porProc = conta(vinc.data ?? []);
  const porCampo = conta(campos.data ?? []);

  return (reqs.data ?? []).map((r) => ({
    ...(r as Requisito),
    procedimentos: porProc.get(r.id as string) ?? 0,
    perguntas: porCampo.get(r.id as string) ?? 0,
  }));
}

export async function criarRequisito(
  tenantId: string,
  nome: string
): Promise<Requisito> {
  const { data, error } = await supabase
    .from("requisitos")
    .insert({ tenant_id: tenantId, nome })
    .select("id, nome, descricao, validade_dias, bloqueia, url_base, ativo")
    .single();
  if (error) throw error;
  return data as Requisito;
}

export async function salvarRequisito(
  id: string,
  campos: Partial<Omit<Requisito, "id">>
): Promise<void> {
  const { error } = await supabase.from("requisitos").update(campos).eq("id", id);
  if (error) throw error;
}

// ── Perguntas ───────────────────────────────────────────────────────────────

export async function listarCampos(
  requisitoId: string
): Promise<CampoRequisito[]> {
  const { data, error } = await supabase
    .from("requisito_campos")
    .select("id, requisito_id, ordem, chave, pergunta, tipo, obrigatorio, alerta_se")
    // Desempate por `chave`: `ordem` tem default 100 e repete em campo novo,
    // e sem desempate a lista dança entre um carregamento e outro.
    .eq("requisito_id", requisitoId)
    .order("ordem")
    .order("chave");
  if (error) throw error;
  return (data ?? []) as CampoRequisito[];
}

export async function criarCampo(
  tenantId: string,
  requisitoId: string,
  campo: { chave: string; pergunta: string; ordem: number }
): Promise<CampoRequisito> {
  const { data, error } = await supabase
    .from("requisito_campos")
    .insert({
      tenant_id: tenantId,
      requisito_id: requisitoId,
      chave: limparChave(campo.chave),
      pergunta: campo.pergunta,
      ordem: campo.ordem,
    })
    .select("id, requisito_id, ordem, chave, pergunta, tipo, obrigatorio, alerta_se")
    .single();
  if (error) throw error;
  return data as CampoRequisito;
}

export async function salvarCampo(
  id: string,
  campos: Partial<{
    chave: string;
    pergunta: string;
    tipo: TipoCampo;
    obrigatorio: boolean;
    alerta_se: string | null;
    ordem: number;
  }>
): Promise<void> {
  const limpo = campos.chave ? { ...campos, chave: limparChave(campos.chave) } : campos;
  const { error } = await supabase.from("requisito_campos").update(limpo).eq("id", id);
  if (error) throw error;
}

export async function removerCampo(id: string): Promise<void> {
  const { error } = await supabase.from("requisito_campos").delete().eq("id", id);
  if (error) throw error;
}

/** Grava a ordem inteira depois de um arrasto. */
export async function reordenarCampos(
  ids: string[]
): Promise<void> {
  // Um update por linha: são poucas perguntas por requisito, e um upsert em
  // lote exigiria mandar `tenant_id` e `chave` de volta, o que abriria espaço
  // para sobrescrever com dado velho da tela.
  await Promise.all(
    ids.map((id, i) =>
      supabase.from("requisito_campos").update({ ordem: (i + 1) * 10 }).eq("id", id)
    )
  );
}

/**
 * Quantas respostas JÁ GRAVADAS usam esta chave.
 *
 * ⚠️ Serve para o aviso de que trocar a chave QUEBRA O HISTÓRICO: as respostas
 * antigas guardam a chave velha dentro do `jsonb`, e depois do renome ninguém
 * mais consegue ligar uma coisa à outra. A chave é normalizada para
 * `[a-z0-9_]` antes de entrar no filtro, então ela não carrega sintaxe.
 */
export async function contarRespostasComChave(
  requisitoId: string,
  chave: string
): Promise<number> {
  const c = limparChave(chave);
  if (!c) return 0;
  const { count, error } = await supabase
    .from("requisito_respostas")
    .select("id", { count: "exact", head: true })
    .eq("requisito_id", requisitoId)
    .not(`respostas->>${c}`, "is", null);
  if (error) throw error;
  return count ?? 0;
}

// ── Quais procedimentos exigem ──────────────────────────────────────────────

export interface ProcedimentoSimples {
  id: string;
  nome: string;
  ativo: boolean;
}

export async function listarProcedimentos(): Promise<ProcedimentoSimples[]> {
  const { data, error } = await supabase
    .from("procedimentos")
    .select("id, nome, ativo")
    .order("nome")
    .limit(500);
  if (error) throw error;
  return (data ?? []) as ProcedimentoSimples[];
}

export async function listarVinculos(requisitoId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("requisito_procedimentos")
    .select("procedimento_id")
    .eq("requisito_id", requisitoId);
  if (error) throw error;
  return (data ?? []).map((v) => v.procedimento_id as string);
}

export async function vincularProcedimento(
  tenantId: string,
  requisitoId: string,
  procedimentoId: string
): Promise<void> {
  const { error } = await supabase.from("requisito_procedimentos").insert({
    tenant_id: tenantId,
    requisito_id: requisitoId,
    procedimento_id: procedimentoId,
  });
  if (error) throw error;
}

export async function desvincularProcedimento(
  requisitoId: string,
  procedimentoId: string
): Promise<void> {
  const { error } = await supabase
    .from("requisito_procedimentos")
    .delete()
    .eq("requisito_id", requisitoId)
    .eq("procedimento_id", procedimentoId);
  if (error) throw error;
}
