import "server-only";
import { createClient } from "@supabase/supabase-js";
import { verificarBanco } from "@/lib/env";

// Cliente com a service_role: IGNORA RLS. Só pode existir no servidor.
// O `import "server-only"` acima faz o BUILD QUEBRAR se este módulo for
// importado (mesmo que indiretamente) de um client component.
//
// A chave vem de SUPABASE_SERVICE_ROLE_KEY — sem o prefixo NEXT_PUBLIC_,
// que é justamente o que impede o Next de embuti-la no bundle do browser.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Criado sob demanda (e não no topo do módulo) para que a ausência da chave
// não derrube o `next build`, só a requisição que de fato precisa dela.
export function getSupabaseAdmin() {
  // A service role IGNORA a RLS: apontada para o banco errado, ela escreve lá
  // sem que nenhuma policy atrapalhe. É o caminho onde a trava mais importa.
  verificarBanco(url);

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor."
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
