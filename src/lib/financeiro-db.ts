// Acesso ao Financeiro. Cliente do navegador, autenticado — as policies de
// `pagamentos`, `procedimentos` e `pacotes*` são todas `{authenticated}`, então
// anon não lê nem escreve nada daqui.
//
// ⚠️ TODA consulta nasce com `.limit()` ou `.range()` explícito. O PostgREST
// corta em 1.000 linhas SEM AVISAR e sem erro — foi assim que o chat da dona
// perdeu as mensagens mais recentes. `vw_financeiro_atendimentos` tem 253
// linhas hoje e cresce junto com a agenda.
//
// ⚠️ NUNCA calcular preço por join com `procedimentos`. O valor é o snapshot em
// `agendamentos.valor`, gravado pelo trigger na criação; recalcular reescreveria
// o passado quando a tabela de preços mudasse.

import { supabase } from "@/lib/supabase";
import { buscarTodasAsPaginas } from "@/lib/paginar";
import { limitesTimestamp, type IntervaloISO } from "@/lib/financeiro";
import type {
  AtendimentoFinanceiro,
  FinanceiroResumo,
  PacoteSaldo,
  Pagamento,
} from "@/types/db";

/** Teto de uma página da lista. */
export const PAGINA_ATENDIMENTOS = 50;
/** Teto de segurança para consultas de agregação de página única. */
const TETO_AGREGACAO = 1000;

// ── KPIs ─────────────────────────────────────────────────────────────────────
export async function getFinanceiroResumo(
  iv: IntervaloISO
): Promise<FinanceiroResumo | null> {
  const { data, error } = await supabase.rpc("financeiro_resumo", {
    p_de: iv.de,
    p_ate: iv.ate,
  });
  if (error) throw error;
  // A função devolve UMA linha.
  return ((data ?? []) as FinanceiroResumo[])[0] ?? null;
}

// ── Atendimentos ─────────────────────────────────────────────────────────────
export interface FiltroAtendimentos {
  intervalo: IntervaloISO;
  status?: string;
  categoria?: string;
  /** Só o que falta receber: realizado com saldo em aberto. */
  soPendente?: boolean;
  /** Só os sem vínculo com o catálogo (a fila de conferência). */
  soSemProcedimento?: boolean;
}

/** Uma página da lista. Ordenação determinística (data + id) porque paginar
 *  sem ela faz o Postgres devolver ordem diferente a cada página, duplicando
 *  umas linhas e perdendo outras. */
export async function getAtendimentos(
  f: FiltroAtendimentos,
  pagina = 0
): Promise<{ linhas: AtendimentoFinanceiro[]; total: number | null }> {
  const t = limitesTimestamp(f.intervalo);
  const de = pagina * PAGINA_ATENDIMENTOS;

  let q = supabase
    .from("vw_financeiro_atendimentos")
    .select("*", { count: "exact" })
    .gte("data_agendamento", t.de)
    .lt("data_agendamento", t.ate);

  if (f.categoria) q = q.eq("categoria", f.categoria);
  if (f.soSemProcedimento) q = q.is("procedimento_id", null);
  // "Só o que falta receber" já implica realizado, então ele manda no status.
  if (f.soPendente) q = q.eq("status", "realizado").gt("saldo", 0);
  else if (f.status) q = q.eq("status", f.status);

  const { data, error, count } = await q
    .order("data_agendamento", { ascending: false })
    .order("id", { ascending: false })
    .range(de, de + PAGINA_ATENDIMENTOS - 1);
  if (error) throw error;
  return {
    linhas: (data ?? []) as AtendimentoFinanceiro[],
    total: count ?? null,
  };
}

/** Conjunto INTEIRO do período, para as composições do Bloco 3 — se cortar,
 *  as somas por categoria passam a mentir. Paginado até a página curta. */
export async function getAtendimentosDoPeriodo(
  iv: IntervaloISO
): Promise<AtendimentoFinanceiro[]> {
  const t = limitesTimestamp(iv);
  return buscarTodasAsPaginas<AtendimentoFinanceiro>((de, ate) =>
    supabase
      .from("vw_financeiro_atendimentos")
      .select("*")
      .gte("data_agendamento", t.de)
      .lt("data_agendamento", t.ate)
      .order("data_agendamento", { ascending: false })
      .order("id", { ascending: false })
      .range(de, ate)
  );
}

/**
 * "Total criado": o que ENTROU no funil no período, pela data em que foi
 * marcado. Precisa de query própria porque a view filtra por
 * `data_agendamento`, e aqui o recorte é `criado_em` — um agendamento feito
 * hoje para setembro conta hoje.
 *
 * O valor é sempre o snapshot de `agendamentos.valor`, nunca preço de tabela.
 */
export async function getCriadosNoPeriodo(
  iv: IntervaloISO
): Promise<{ valor: number; qtd: number }> {
  const t = limitesTimestamp(iv);
  const linhas = await buscarTodasAsPaginas<{ valor: string | null }>(
    (de, ate) =>
      supabase
        .from("agendamentos")
        .select("valor")
        .gte("criado_em", t.de)
        .lt("criado_em", t.ate)
        .order("criado_em", { ascending: false })
        .order("id", { ascending: false })
        .range(de, ate)
  );
  let valor = 0;
  for (const l of linhas) valor += Number(l.valor) || 0;
  return { valor, qtd: linhas.length };
}

/**
 * Agendamentos que nasceram de um follow-up. Alimenta "Receita recuperada":
 * cliente que voltou depois de ser cutucado.
 *
 * Devolve só os ids — quem soma é a tela, cruzando com os atendimentos do
 * período que ela já carregou. Evita um join e não busca nada duas vezes.
 */
export async function getAgendamentosDeFollowUp(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("follow_ups")
    .select("agendamento_id")
    .not("agendamento_id", "is", null)
    .order("id", { ascending: false })
    .limit(TETO_AGREGACAO);
  if (error) throw error;
  const ids = new Set<string>();
  for (const r of (data ?? []) as { agendamento_id: string | null }[]) {
    if (r.agendamento_id) ids.add(r.agendamento_id);
  }
  return ids;
}

/** A divisão por profissional só existe quando a Agenda começar a atribuir.
 *  Uma linha basta para decidir se o card aparece — condição no DADO, não
 *  comentário no código, então ele volta sozinho. */
export async function temProfissionalAtribuido(): Promise<boolean> {
  const { data, error } = await supabase
    .from("vw_financeiro_atendimentos")
    .select("id")
    .not("profissional_id", "is", null)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

// ── Pagamentos ───────────────────────────────────────────────────────────────
/** Recebido por forma. Taxa de maquininha come margem e pix não — por isso a
 *  quebra importa. */
export async function getPagamentosDoPeriodo(
  iv: IntervaloISO
): Promise<Pagamento[]> {
  const t = limitesTimestamp(iv);
  const { data, error } = await supabase
    .from("pagamentos")
    .select("*")
    .gte("pago_em", t.de)
    .lt("pago_em", t.ate)
    .order("pago_em", { ascending: false })
    .order("id", { ascending: false })
    .limit(TETO_AGREGACAO);
  if (error) throw error;
  return (data ?? []) as Pagamento[];
}

export interface NovoPagamento {
  lead_id: string;
  agendamento_id: string | null;
  /** Estorno entra NEGATIVO: o saldo da view é `valor - soma(pagamentos)`,
   *  então valor negativo faz o saldo voltar a subir sozinho. Não existe
   *  "cancelar pagamento". O banco recusa zero (`pagamentos_valor_check`). */
  valor: number;
  forma: string;
  tipo: string;
  registrado_por?: string | null;
  observacao?: string | null;
}

export async function insertPagamento(p: NovoPagamento): Promise<void> {
  const { error } = await supabase.from("pagamentos").insert({
    lead_id: p.lead_id,
    agendamento_id: p.agendamento_id,
    valor: p.valor,
    forma: p.forma,
    tipo: p.tipo,
    registrado_por: p.registrado_por || null,
    observacao: p.observacao || null,
  });
  if (error) throw error;
}

// ── Pacotes ──────────────────────────────────────────────────────────────────
/** O contrapeso obrigatório do Bloco 1: a receita de pacote é reconhecida
 *  INTEIRA na venda, então os meses de entrega aparecem vazios no "Recebido".
 *  Sem este passivo à vista, o mês parece ruim quando a clínica só está
 *  entregando o que já vendeu. */
export async function getPacotesSaldo(): Promise<PacoteSaldo[]> {
  const { data, error } = await supabase
    .from("vw_pacotes_saldo")
    .select("*")
    .gt("sessoes_restantes", 0)
    .order("vendido_em", { ascending: false })
    .order("venda_id", { ascending: false })
    .limit(TETO_AGREGACAO);
  if (error) throw error;
  return (data ?? []) as PacoteSaldo[];
}

/** Categorias existentes, para o filtro da lista. */
export async function getCategorias(): Promise<string[]> {
  const { data, error } = await supabase
    .from("vw_financeiro_atendimentos")
    .select("categoria")
    .not("categoria", "is", null)
    .limit(TETO_AGREGACAO);
  if (error) throw error;
  const vistos = new Set<string>();
  for (const r of (data ?? []) as { categoria: string | null }[]) {
    if (r.categoria) vistos.add(r.categoria);
  }
  return [...vistos].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
