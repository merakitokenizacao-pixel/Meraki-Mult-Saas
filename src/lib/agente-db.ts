import { supabase } from "@/lib/supabase";

// O interruptor da agente.
//
// `tenant_config` tem a RLS padrão (`tenant_id IN meus_tenants()`) em USING e
// em WITH CHECK, então o navegador pode escrever: o `tenant_id` que ele informa
// é conferido pela policy. O navegador informa, o banco confere.
//
// ⚠️ O FILTRO POR TENANT É OBRIGATÓRIO aqui, e não é o redundante que o
// CLAUDE.md proíbe: a RLS recorta a consulta a TODAS as clínicas da conta, e
// `tenant_config` tem uma linha por clínica. Sem o `.eq`, uma conta com duas
// clínicas desligaria a agente das duas de uma vez.
export async function salvarAgenteAtivo(
  tenantId: string,
  ativo: boolean
): Promise<void> {
  const { error } = await supabase
    .from("tenant_config")
    .update({ agente_ativo: ativo })
    .eq("tenant_id", tenantId);
  if (error) throw error;
}
