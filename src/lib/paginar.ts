import type { PostgrestError } from "@supabase/supabase-js";

// ── Teto de 1.000 linhas do PostgREST ────────────────────────────────────────
// O PostgREST devolve no máximo 1.000 linhas por requisição e NÃO sinaliza
// quando corta: sem erro, sem status diferente, sem aviso. Uma query sem
// `.limit()` não traz "tudo" — traz "até mil, e cala".
//
// Onde a tela precisa do conjunto inteiro (métricas, funil, grade da agenda),
// a busca é paginada por `.range()` até vir uma página curta.
//
// ⚠️ EXIGE ORDENAÇÃO DETERMINÍSTICA. Sem um `order` estável o Postgres pode
// devolver as linhas em ordem diferente a cada página, duplicando umas e
// perdendo outras — por isso toda chamada ordena por uma coluna única
// (id, lead_id) como desempate.
//
// Sem dependência de cliente: serve tanto ao cliente do navegador (queries.ts)
// quanto ao de service role (followup-db.ts).

export const PAGINA_REST = 1000;
const TETO_PAGINAS = 20; // trava contra loop infinito, não limite de negócio

export async function buscarTodasAsPaginas<T>(
  pagina: (
    de: number,
    ate: number
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<T[]> {
  const tudo: T[] = [];
  for (let i = 0; i < TETO_PAGINAS; i++) {
    const de = i * PAGINA_REST;
    const { data, error } = await pagina(de, de + PAGINA_REST - 1);
    if (error) throw error;
    const lote = data ?? [];
    tudo.push(...lote);
    if (lote.length < PAGINA_REST) return tudo; // página curta = acabou
  }
  return tudo;
}
