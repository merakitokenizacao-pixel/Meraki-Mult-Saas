import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { FollowUp } from "@/lib/followup";

// Leitura da view `follow_ups_resultado` (calcula o resultado ao vivo).
// Somente leitura: quem escreve em `follow_ups` é o n8n. Ver AGENTE.md.
//
// A view respeita RLS; acesso via service role, como o resto do painel.
export async function listarFollowUps(): Promise<FollowUp[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("follow_ups_resultado")
    .select(
      "id, lead_id, nome, telefone, tipo, status, mensagem, contexto, enviado_em, primeira_resposta_em, agendou_em, resultado"
    )
    .order("enviado_em", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as FollowUp[];
}
