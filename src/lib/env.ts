// Trava de ambiente. Roda no BOOT (importada pelo next.config.ts), então pega
// `dev`, `build` e `start` — antes de qualquer requisição, antes de qualquer
// escrita.
//
// Por que existe: este repositório é um clone do painel antigo, cujo
// `.env.local` apontava para o banco de PRODUÇÃO de uma clínica real. Um
// `.env.local` copiado por engano de lá para cá — ou uma env var esquecida na
// Vercel — faz o painel novo gravar lead, mensagem e agendamento no banco da
// clínica que está atendendo gente de verdade. Não haveria erro: as tabelas
// têm nomes parecidos e a escrita simplesmente funcionaria.
//
// Revisão de código não pega isso, porque o erro não está no código; está numa
// variável que nem é versionada. Uma checagem no boot pega.

/** O único projeto Supabase que este painel pode tocar. */
export const PROJETO_SUPABASE = "hcexbbmgfekpaakerfys";

const MSG = "banco errado — este painel é do Meraki";

/**
 * Derruba a aplicação se a URL do Supabase não for a do Meraki.
 *
 * Ausência da variável NÃO é tratada aqui: quem cuida disso é
 * `src/lib/supabase.ts`, com uma mensagem que diz o que falta. Aqui o assunto
 * é outro — uma URL *presente* e *errada*, que é o caso perigoso, porque
 * funciona.
 */
export function verificarBanco(url: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): void {
  if (!url) return;
  if (url.includes(PROJETO_SUPABASE)) return;

  throw new Error(
    `${MSG}\n\n` +
      `  NEXT_PUBLIC_SUPABASE_URL aponta para: ${url}\n` +
      `  esperado: https://${PROJETO_SUPABASE}.supabase.co\n\n` +
      `Se você copiou o .env.local do painel antigo, apague e refaça a partir ` +
      `do .env.example. Esta checagem não deve ser afrouxada para "testar rápido".`
  );
}
