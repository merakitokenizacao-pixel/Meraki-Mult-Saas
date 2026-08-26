import "server-only";
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { CABECALHO_TENANT, ehTenantId, type Clinica } from "@/lib/tenant";

// Resolve QUAL clínica esta requisição pode ver.
//
// É o pedágio de toda rota que usa service_role. A service role ignora a RLS:
// dentro dela, `from("leads").select("*")` devolve os leads de TODAS as
// clínicas. O filtro por tenant deixa de ser automático e passa a ser
// responsabilidade de quem escreve a rota — então precisa de um único lugar
// que faça isso certo, e é este.
//
// A regra de ouro (CLAUDE.md): o navegador nunca ESCOLHE o tenant; ele
// INFORMA, e quem valida é o banco. O que chega no cabeçalho é palpite até
// `tenant_valido()` confirmar contra `auth.uid()`.
//
// Note que a validação sai pelo cliente de SESSÃO (anon key), não pela service
// role: é o que faz `auth.uid()` dentro da função enxergar o usuário de
// verdade. Validar com service role perguntaria "este tenant existe?" quando a
// pergunta é "este tenant é DESTA conta?".

export class TenantErro extends Error {
  constructor(
    readonly codigo: string,
    readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = "TenantErro";
  }
}

/**
 * A clínica desta requisição, já validada contra a sessão.
 *
 * @param req requisição — o tenant informado vem do cabeçalho.
 * @throws TenantErro quando não há sessão, a conta não tem clínica, o tenant
 *   informado não é dela, ou a conta tem várias e não disse qual.
 */
export async function resolverTenant(req: Request): Promise<Clinica> {
  const informado = req.headers.get(CABECALHO_TENANT);
  return resolverTenantPorId(informado);
}

/** Mesma coisa, para quem já tem o id em mãos (corpo de POST, por exemplo). */
export async function resolverTenantPorId(
  informado?: string | null
): Promise<Clinica> {
  const sb = await getSupabaseServer();

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    throw new TenantErro("nao_autenticado", 401, "Sessão ausente ou expirada.");
  }

  if (informado && !ehTenantId(informado)) {
    throw new TenantErro("tenant_invalido", 400, "Clínica informada é inválida.");
  }

  // `minhas_clinicas()` é SECURITY DEFINER sobre auth.uid(): devolve só as
  // clínicas desta conta, então a lista já é o universo permitido.
  const { data, error } = await sb.rpc("minhas_clinicas");
  if (error) {
    throw new TenantErro("erro_interno", 500, error.message);
  }
  const clinicas = (data ?? []) as Clinica[];

  if (clinicas.length === 0) {
    throw new TenantErro(
      "sem_clinica",
      403,
      "Esta conta não está vinculada a nenhuma clínica."
    );
  }

  if (!informado) {
    // Uma clínica só: o tenant é implícito, não há o que escolher.
    if (clinicas.length === 1) return clinicas[0];

    // Várias, e o cliente não disse qual. Aqui NÃO delegamos para
    // `tenant_valido(null)`: com mais de um vínculo, aquela função pega a
    // primeira linha que o Postgres devolver — sem ordenação, sem erro. Uma
    // conta com duas clínicas veria a resposta de uma delas ao acaso, o que é
    // pior que uma falha, porque parece que funcionou.
    throw new TenantErro(
      "tenant_nao_informado",
      400,
      "Esta conta atende mais de uma clínica; informe qual."
    );
  }

  // Autoridade é o banco. A checagem contra a lista viria de graça, mas quem
  // decide precisa ser `tenant_valido()`: se o vínculo mudar, muda num lugar.
  const { error: erroValidacao } = await sb.rpc("tenant_valido", {
    p_tenant: informado,
  });
  if (erroValidacao) {
    // A função levanta exceção para tenant que não é da conta.
    throw new TenantErro(
      "tenant_negado",
      403,
      "Esta conta não tem acesso a essa clínica."
    );
  }

  const clinica = clinicas.find((c) => c.tenant_id === informado);
  if (!clinica) {
    // Chegar aqui significa que `tenant_valido` aprovou algo que
    // `minhas_clinicas` não lista — clínica inativa, por exemplo. Sem slug não
    // dá para montar caminho de storage, então é negativa.
    throw new TenantErro("tenant_negado", 403, "Clínica indisponível.");
  }
  return clinica;
}

/**
 * A clínica da VITRINE — a que a landing pública mostra.
 *
 * Caso à parte, e único: aqui não existe sessão de onde derivar tenant, porque
 * quem chama é um visitante anônimo. O escopo então vem de CONFIGURAÇÃO, nunca
 * do pedido: `MERAKI_TENANT_DEMO` guarda o slug, no servidor.
 *
 * Não aceitar o slug por querystring é o ponto. Uma rota pública que
 * escolhesse a clínica pelo parâmetro deixaria qualquer visitante consultar a
 * agenda de qualquer cliente do Meraki trocando uma palavra na URL.
 *
 * Sem a variável configurada, devolve null e a rota responde "indisponível" —
 * o padrão seguro é não mostrar nada, e não mostrar a primeira que aparecer.
 */
export async function tenantDaVitrine(): Promise<Clinica | null> {
  const slug = process.env.MERAKI_TENANT_DEMO?.trim();
  if (!slug) return null;

  // service_role aqui é correto: não há usuário, e a pergunta é sobre uma
  // clínica específica escolhida pelo operador do sistema, não pelo visitante.
  const { getSupabaseAdmin } = await import("@/lib/supabase-admin");
  const { data, error } = await getSupabaseAdmin()
    .from("tenants")
    .select("id, slug, nome")
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle();
  if (error || !data) return null;
  return { tenant_id: data.id, slug: data.slug, nome: data.nome, papel: "vitrine" };
}

/** Traduz o erro em resposta JSON. Nunca vaza mensagem do Postgres. */
export function respostaErroTenant(e: unknown): NextResponse {
  if (e instanceof TenantErro) {
    return NextResponse.json(
      { erro: e.codigo, detalhe: e.status === 500 ? undefined : e.message },
      { status: e.status }
    );
  }
  return NextResponse.json({ erro: "erro_interno" }, { status: 500 });
}
