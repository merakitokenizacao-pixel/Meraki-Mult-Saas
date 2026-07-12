import { createBrowserClient } from "@supabase/ssr";

// Cliente do NAVEGADOR. Trocou de `createClient` para `createBrowserClient`
// (@supabase/ssr) para que a sessão do login viva em COOKIE, e não em
// localStorage — é o que permite o middleware e os server components lerem a
// MESMA sessão. O nome do export não mudou de propósito: `queries.ts` e o
// realtime das Conversas seguem iguais, só que agora as requisições saem
// autenticadas.
//
// A anon key continua pública (vai no bundle, por design do Supabase). Quem
// protege os dados é a RLS: as policies passam a exigir `authenticated`.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias. Configure o .env.local."
  );
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
