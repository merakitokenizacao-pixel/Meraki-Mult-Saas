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

  // Quem decide é `tenant_valido()` — inclusive quando nada foi informado.
  //
  // Antes esta função resolvia o caso implícito por conta própria, porque a
  // versão anterior de `tenant_valido(null)` fazia `limit 2` e ficava com a
  // primeira linha que viesse: uma conta com dois vínculos veria uma das
  // clínicas ao acaso. Hoje ela distingue os casos e levanta com `errcode`
  // próprio, então a regra volta a morar num lugar só — o banco.
  //
  // `minhas_clinicas()` sai em paralelo porque a resposta precisa do SLUG (o
  // caminho de storage é montado com ele) e `tenant_valido` devolve só o uuid.
  const [validacao, listagem] = await Promise.all([
    sb.rpc("tenant_valido", { p_tenant: informado ?? null }),
    sb.rpc("minhas_clinicas"),
  ]);

  if (validacao.error) throw erroDoBanco(validacao.error, informado);
  if (listagem.error) {
    throw new TenantErro("erro_interno", 500, listagem.error.message);
  }

  const escolhido = validacao.data as string | null;
  const clinicas = (listagem.data ?? []) as Clinica[];
  const clinica = clinicas.find((c) => c.tenant_id === escolhido);

  if (!clinica) {
    // `tenant_valido` aprovou algo que `minhas_clinicas` não lista — clínica
    // inativa, por exemplo (a listagem filtra por `t.ativo`). Sem slug não dá
    // para montar caminho de storage, então é negativa.
    throw new TenantErro("sem_acesso", 403, "Clínica indisponível.");
  }
  return clinica;
}

/**
 * Traduz a exceção do Postgres. "Sem acesso" e "escolha a clínica" são
 * situações DIFERENTES e precisam de respostas diferentes: a primeira é um
 * beco sem saída para o usuário (alguém tem que vincular a conta), a segunda
 * se resolve escolhendo no seletor. Responder 403 para as duas mandaria quem
 * tem duas clínicas procurar um problema de permissão que não existe.
 */
function erroDoBanco(
  erro: { code?: string; message?: string },
  informado?: string | null
): TenantErro {
  // 42501 = insufficient_privilege. Vem de dois pontos de `tenant_valido`:
  // tenant informado que não é da conta, e conta sem vínculo nenhum.
  if (erro.code === "42501") {
    return informado
      ? new TenantErro("sem_acesso", 403, "Esta conta não tem acesso a essa clínica.")
      : new TenantErro(
          "sem_clinica",
          403,
          "Esta conta ainda não está vinculada a nenhuma clínica."
        );
  }
  // 22023 = invalid_parameter_value. A conta atende mais de uma e não disse
  // qual — é o seletor que resolve, não o suporte.
  if (erro.code === "22023") {
    return new TenantErro(
      "escolha_clinica",
      400,
      "Esta conta atende mais de uma clínica; escolha qual."
    );
  }
  return new TenantErro("erro_interno", 500, erro.message ?? "");
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
