import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buscarTodasAsPaginas } from "@/lib/paginar";
import type { FollowUp } from "@/lib/followup";

// Leitura da view `follow_ups_resultado` (calcula o resultado ao vivo).
// Somente leitura: quem escreve em `follow_ups` é o n8n. Ver AGENTE.md.
//
// TENANT: service_role ignora RLS, entao o filtro por clinica e obrigacao
// daqui. O tenant chega JA VALIDADO por resolverTenant().
export async function listarFollowUps(tenant: string): Promise<FollowUp[]> {
  const db = getSupabaseAdmin();
  // Paginada: quem escreve aqui é o n8n, uma linha por disparo, então a tabela
  // cresce sozinha e passaria do teto de 1.000 do PostgREST sem avisar (ver
  // src/lib/paginar.ts). E truncar aqui não perderia só linhas da lista — a
  // tela compara métricas POR TIPO, que sairiam erradas sobre um conjunto
  // cortado. Desempate por `id` porque `enviado_em` pode ser nulo.
  return buscarTodasAsPaginas<FollowUp>((de, ate) =>
    db
      .from("follow_ups_resultado")
      .select(
        "id, lead_id, nome, telefone, tipo, referencia, status, mensagem, contexto, enviado_em, primeira_resposta_em, agendou_em, resultado"
      )
      .eq("tenant_id", tenant)
      .order("enviado_em", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .range(de, ate)
  );
}
