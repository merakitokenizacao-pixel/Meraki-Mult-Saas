import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { resolverTenant, respostaErroTenant } from "@/lib/tenant-server";
import { registrarErro } from "@/lib/log-erro";
import {
  EvolutionErro,
  criarInstancia,
  definirWebhook,
  desconectar,
  estadoConexao,
  instanciaDoSlug,
  qrConexao,
} from "@/lib/evolution";

export const dynamic = "force-dynamic";

// Conectar o WhatsApp da clínica, sem ninguém do Meraki no meio.
//
// ⚠️ A CHAVE DA EVOLUTION NÃO SAI DAQUI. `EVOLUTION_API_KEY` não tem
// `NEXT_PUBLIC_` de propósito: ela manda mensagem em nome da clínica, e no
// bundle do navegador qualquer um a leria no DevTools. Toda chamada à Evolution
// acontece neste arquivo.
//
// ⚠️ E O PAINEL NUNCA LÊ A EVOLUTION DIRETO — ele lê o BANCO. Cada ação grava o
// resultado com `canal_estado()`, e a tela consulta `minha_conexao()`. Sem isso
// o estado viveria só na memória da Evolution: um F5 no meio do pareamento, ou
// o n8n consultando por outro caminho, veriam realidades diferentes.

/** O que a tela recebe, sempre vindo do banco. */
interface Conexao {
  identificador: string | null;
  numero: string | null;
  status: string | null;
  conectado_em: string | null;
  ultimo_erro: string | null;
  slug: string;
}

async function lerDoBanco(tenantId: string): Promise<Conexao | null> {
  const sb = await getSupabaseServer();
  const { data, error } = await sb.rpc("minha_conexao", { p_tenant: tenantId });
  if (error) throw error;
  return ((data ?? [])[0] as Conexao | undefined) ?? null;
}

async function gravar(
  tenantId: string,
  identificador: string,
  status: string,
  numero: string | null,
  erro: string | null
): Promise<void> {
  const sb = await getSupabaseServer();
  const { error } = await sb.rpc("canal_estado", {
    p_tenant: tenantId,
    p_identificador: identificador,
    p_status: status,
    p_numero: numero,
    p_erro: erro,
  });
  if (error) throw error;
}

/** O endereço que a Evolution chama quando chega mensagem. */
function urlDoWebhook(): string | null {
  const u = process.env.N8N_WEBHOOK_URL?.trim();
  return u || null;
}

// ── GET ?acao=estado ────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { tenant_id, slug } = await resolverTenant(req);
    const instancia = instanciaDoSlug(slug);

    // Pergunta à Evolution e GRAVA o que ela respondeu. A tela lê do banco na
    // linha seguinte, então ela nunca depende de a Evolution estar de pé para
    // mostrar alguma coisa.
    try {
      const st = await estadoConexao(instancia);
      await gravar(
        tenant_id,
        instancia,
        st.estado,
        st.numero,
        st.estado === "desconectado" && st.bruto !== "inexistente"
          ? `WhatsApp em estado "${st.bruto}"`
          : null
      );
    } catch (e) {
      // Falar do estado é diferente de falhar: quando não dá para perguntar, a
      // resposta honesta é o último estado conhecido, não "desconectado" —
      // dizer que caiu sem ter checado faria a dona correr atrás de um problema
      // que não existe.
      registrarErro("conexao/estado", e);
    }

    return NextResponse.json(
      { conexao: await lerDoBanco(tenant_id) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    registrarErro("conexao", e);
    return respostaErroTenant(e);
  }
}

// ── POST ?acao=conectar ─────────────────────────────────────────────────────

export async function POST(req: Request) {
  let tenantId = "";
  let instancia = "";
  try {
    const { tenant_id, slug } = await resolverTenant(req);
    tenantId = tenant_id;
    instancia = instanciaDoSlug(slug);

    // Já existente não é falha: é uma clínica reconectando.
    await criarInstancia(instancia);

    // O webhook é o que faz a mensagem recebida virar linha em `conversas`.
    // Falhar aqui não impede o pareamento, mas precisa ficar registrado — sem
    // ele a instância pareia e fica muda.
    let avisoWebhook: string | null = null;
    const wh = urlDoWebhook();
    if (!wh) {
      avisoWebhook =
        "Conectado, mas o recebimento de mensagens não está configurado (falta N8N_WEBHOOK_URL no servidor).";
    } else {
      try {
        await definirWebhook(instancia, wh);
      } catch (e) {
        avisoWebhook =
          e instanceof EvolutionErro ? e.message : "Webhook não configurado";
      }
    }

    const { qr, estado } = await qrConexao(instancia);
    await gravar(tenantId, instancia, estado, null, avisoWebhook);

    return NextResponse.json(
      { qr, conexao: await lerDoBanco(tenantId), aviso: avisoWebhook },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    registrarErro("conexao/conectar", e);
    if (e instanceof EvolutionErro) {
      // O erro fica no banco também: a tela recarregada continua explicando o
      // que houve, em vez de voltar para "não conectado" sem motivo.
      if (tenantId && instancia) {
        await gravar(tenantId, instancia, "erro", null, e.message).catch(
          () => {}
        );
      }
      return NextResponse.json({ erro: e.message }, { status: e.status });
    }
    return respostaErroTenant(e);
  }
}

// ── DELETE ?acao=desconectar ────────────────────────────────────────────────

export async function DELETE(req: Request) {
  try {
    const { tenant_id, slug } = await resolverTenant(req);
    const instancia = instanciaDoSlug(slug);
    await desconectar(instancia);
    await gravar(tenant_id, instancia, "desconectado", null, null);
    return NextResponse.json(
      { conexao: await lerDoBanco(tenant_id) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    registrarErro("conexao/desconectar", e);
    if (e instanceof EvolutionErro) {
      return NextResponse.json({ erro: e.message }, { status: e.status });
    }
    return respostaErroTenant(e);
  }
}
