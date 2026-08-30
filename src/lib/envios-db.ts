import { supabase } from "@/lib/supabase";
import { TIPOS_ENVIO, type RegraEnvio, type TipoEnvio } from "@/lib/envios";

// Leitura e escrita de `envios_regras` pelo cliente do NAVEGADOR.
//
// TENANT: a tabela tem RLS `tenant_id IN (SELECT meus_tenants())` em USING e em
// WITH CHECK. A leitura já vem filtrada — nada de `where tenant_id` manual. E o
// update não precisa informar tenant nenhum: ele filtra por `tipo` e a policy
// recorta o resto. Uma conta com duas clínicas é o caso que exige atenção, e é
// por isso que `salvarRegra` recebe o tenant e filtra pelos DOIS pedaços da
// chave composta.

const COLUNAS =
  "tipo, ativo, antecedencia_horas, atraso_horas, janela_inicio, janela_fim, " +
  "dias_semana, min_horas_apos_criacao, max_por_lead_dia, max_por_lead_periodo, " +
  "periodo_dias, respeita_pausa, respeita_optout, pular_se_frequente, " +
  "frequente_min_visitas, frequente_dias";

export async function listarRegras(tenantId: string): Promise<RegraEnvio[]> {
  const { data, error } = await supabase
    .from("envios_regras")
    .select(COLUNAS)
    // ⚠️ Filtro explícito, e ele NÃO é o redundante que o CLAUDE.md proíbe: a
    // RLS escopa a TODAS as clínicas da conta, e a chave é `(tenant_id, tipo)`.
    // Numa conta com duas clínicas viriam oito linhas com quatro tipos
    // repetidos, e a tela mostraria a regra de qualquer uma das duas.
    .eq("tenant_id", tenantId);
  if (error) throw error;

  // O cast é necessário: com a lista de colunas em constante, o supabase-js
  // não consegue inferir a forma da linha e cai em GenericStringError.
  const linhas = (data ?? []) as unknown as RegraEnvio[];
  const porTipo = new Map(linhas.map((r) => [r.tipo, r]));
  // A ordem é a dos TIPOS, não a do banco: "lembrete, retomada, compromisso,
  // reativação" é a ordem em que as coisas acontecem na vida da cliente.
  return TIPOS_ENVIO.map((t) => porTipo.get(t)).filter(Boolean) as RegraEnvio[];
}

/**
 * Sempre UPDATE, nunca insert.
 *
 * ⚠️ As quatro linhas já existem, e a tela não cria tipo novo: `envio_pode`
 * recusa qualquer tipo sem regra ("sem regra configurada para X"), então uma
 * linha inventada aqui só produziria um envio que nunca sai. A PK composta
 * `(tenant_id, tipo)` exige os dois no filtro.
 */
export async function salvarRegra(
  tenantId: string,
  tipo: TipoEnvio,
  campos: Partial<Omit<RegraEnvio, "tipo">>
): Promise<void> {
  const { error } = await supabase
    .from("envios_regras")
    .update(campos)
    .eq("tenant_id", tenantId)
    .eq("tipo", tipo);
  if (error) throw error;
}

// ── Dispensa individual, na ficha do cliente ────────────────────────────────

/**
 * O override manual: a regra automática pega o caso comum, e a dona conhece a
 * exceção que o número não pega. `envio_pode` compara com
 * `p_tipo = any(dispensa_envios)` — MANUAL SEMPRE VENCE, antes até de olhar
 * pausa, opt-out e frequência.
 */
export async function salvarDispensa(
  leadId: string,
  tipos: TipoEnvio[]
): Promise<void> {
  const { error } = await supabase
    .from("leads")
    // Array vazio, não `null`: os dois se comportam igual em `envio_pode`
    // (ele faz `coalesce(..., '{}')`), mas `{}` diz "conferido, não dispensa
    // nada" enquanto `null` diz "ninguém mexeu nisso".
    .update({ dispensa_envios: tipos })
    .eq("id", leadId);
  if (error) throw error;
}
