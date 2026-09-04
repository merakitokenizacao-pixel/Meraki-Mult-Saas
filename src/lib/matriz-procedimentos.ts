// Quem faz o quê — camada de dados da matriz profissional × procedimento.
//
// A REGRA CENTRAL, e a razão de não existir coluna booleana em lugar nenhum:
// linha presente em `profissional_procedimentos` = a profissional faz. Linha
// ausente = não faz. Marcar é `insert`, desmarcar é `delete`.
//
// As três tabelas têm RLS com policy `ALL` para `authenticated`, igual a
// `profissionais` — então isto roda do navegador, sem rota de servidor.

import { supabase } from "@/lib/supabase";

export interface Procedimento {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface ProfissionalMatriz {
  id: string;
  nome: string;
  cor: string;
  ativo: boolean;
}

export interface Vinculo {
  profissional_id: string;
  procedimento_id: string;
}

export interface DadosMatriz {
  procedimentos: Procedimento[];
  profissionais: ProfissionalMatriz[];
  vinculos: Vinculo[];
}

/** Chave da célula. Uma string só evita ter que varrer um array a cada render
 *  — com 20 × 4 são 80 células, e cada uma perguntaria "eu estou marcada?". */
export function chaveCelula(profissionalId: string, procedimentoId: string): string {
  return `${profissionalId}|${procedimentoId}`;
}

/**
 * Teto explícito nas três leituras.
 *
 * O volume aqui é pequeno (20 procedimentos, 4 profissionais, 80 vínculos no
 * máximo), mas o PostgREST corta em 1.000 linhas SEM avisar — sem erro, sem
 * status diferente. Escrever o limite deixa o teto visível para quem mexer
 * depois, em vez de esperar a base crescer e a matriz começar a mentir.
 */
const TETO = 2000;

export async function getMatriz(): Promise<DadosMatriz> {
  const [proc, prof, vinc] = await Promise.all([
    supabase
      .from("procedimentos")
      .select("id,nome,ativo")
      .order("nome")
      .limit(TETO),
    supabase
      .from("profissionais")
      .select("id,nome,cor,ativo")
      .order("nome")
      .limit(TETO),
    supabase
      .from("profissional_procedimentos")
      .select("profissional_id,procedimento_id")
      .limit(TETO),
  ]);
  if (proc.error) throw proc.error;
  if (prof.error) throw prof.error;
  if (vinc.error) throw vinc.error;

  return {
    procedimentos: (proc.data ?? []) as Procedimento[],
    profissionais: (prof.data ?? []) as ProfissionalMatriz[],
    vinculos: (vinc.data ?? []) as Vinculo[],
  };
}

// ── Escrita ───────────────────────────────────────────────────────────

export async function marcar(pares: Vinculo[]): Promise<void> {
  if (pares.length === 0) return;
  // `upsert` e não `insert`: a chave primária é (profissional_id,
  // procedimento_id), e marcar uma coluna inteira inclui células que já
  // estavam marcadas — com `insert` puro isso seria erro 23505 e a ação em
  // lote falharia por causa do que já estava certo.
  const { error } = await supabase
    .from("profissional_procedimentos")
    .upsert(pares, { onConflict: "profissional_id,procedimento_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function desmarcar(pares: Vinculo[]): Promise<void> {
  if (pares.length === 0) return;
  // Um `delete` só para o lote inteiro. Como a chave é composta, o filtro é
  // por `or(...)` de pares — `in` sozinho apagaria o produto cartesiano, ou
  // seja, desmarcar a linha de uma profissional derrubaria a das outras.
  const filtro = pares
    .map(
      (p) =>
        `and(profissional_id.eq.${p.profissional_id},procedimento_id.eq.${p.procedimento_id})`
    )
    .join(",");
  const { error } = await supabase
    .from("profissional_procedimentos")
    .delete()
    .or(filtro);
  if (error) throw error;
}

// ── Catálogo ──────────────────────────────────────────────────────────

export async function criarProcedimento(nome: string): Promise<Procedimento> {
  const { data, error } = await supabase
    .from("procedimentos")
    .insert({ nome: nome.trim() })
    .select("id,nome,ativo")
    .single();
  if (error) throw error;
  return data as Procedimento;
}

export async function renomearProcedimento(id: string, nome: string): Promise<void> {
  const { error } = await supabase
    .from("procedimentos")
    .update({ nome: nome.trim() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Desativar NUNCA é delete.
 *
 * Apagar o procedimento levaria junto, por cascade, as linhas da matriz e os
 * 27 apelidos que a agente usa para reconhecer o serviço no WhatsApp — e nada
 * disso volta. `ativo = false` some da tela e preserva tudo.
 */
export async function definirAtivoProcedimento(
  id: string,
  ativo: boolean
): Promise<void> {
  const { error } = await supabase.from("procedimentos").update({ ativo }).eq("id", id);
  if (error) throw error;
}
