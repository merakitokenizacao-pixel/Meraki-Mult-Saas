import "server-only";

/**
 * Imprime o erro DE VERDADE antes de a rota devolver 500.
 *
 * ⚠️ POR QUE ISTO EXISTE: `respostaErroTenant()` traduz qualquer exceção
 * desconhecida em `{ erro: "erro_interno" }` com status 500 — de propósito,
 * para não vazar mensagem do Postgres para o navegador. Só que ela também não
 * escrevia em lugar nenhum, então a exceção sumia: no terminal aparecia o
 * status e mais nada.
 *
 * O objeto útil do supabase-js NÃO é a mensagem do throw: `code`, `details` e
 * `hint` vêm do PostgREST e são o que diz QUAL coluna ou tabela faltou.
 *   42P01  tabela/view não existe
 *   42703  coluna não existe
 *   42501  sem permissão
 *   PGRST  erro do próprio PostgREST (cache de schema, por exemplo)
 */
export function registrarErro(rota: string, e: unknown): void {
  const err = e as {
    message?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    stack?: unknown;
  } | null;
  console.error(`[${rota}] erro:`, {
    message: err?.message,
    code: err?.code,
    details: err?.details,
    hint: err?.hint,
  });
  if (err?.stack) console.error(`[${rota}] stack:`, err.stack);
}
