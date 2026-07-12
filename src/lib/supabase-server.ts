import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Cliente de SERVIDOR (server components e route handlers), lendo a sessão do
// cookie que o middleware mantém fresco. Usa a ANON key + RLS — NÃO confundir
// com `supabase-admin.ts`, que usa a service role e ignora RLS (aquele é só
// para a ficha pública, onde a paciente não tem sessão).
export async function getSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component não pode escrever cookie — o middleware já
            // renova a sessão, então isso é seguro de ignorar.
          }
        },
      },
    }
  );
}

/** Usuário logado (ou null). Use nas rotas do painel para barrar acesso. */
export async function getUsuario() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
