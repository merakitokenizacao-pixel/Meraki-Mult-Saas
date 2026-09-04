import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { resolverTenant, respostaErroTenant } from "@/lib/tenant-server";
import { registrarErro } from "@/lib/log-erro";
import { EvolutionErro, enviarTexto } from "@/lib/evolution";

export const dynamic = "force-dynamic";

// Responder a cliente pelo painel.
//
// ⚠️ GRAVA PRIMEIRO, ENVIA DEPOIS — e a ordem é a decisão inteira desta rota.
// A versão anterior fazia o contrário: mandava para a Evolution e só então
// escrevia em `conversas`. Se a Evolution falhasse, a mensagem sumia sem
// rastro: a pessoa via um erro, não sabia se tinha ido, e a conversa não
// guardava nada. Gravando antes, a mensagem aparece no histórico e a tela pode
// dizer que ela NÃO saiu — que é a informação útil.
//
// `painel_responder` faz três coisas numa transação só: acha o telefone e a
// instância DESTA clínica, PAUSA a agente na conversa (humano assumiu) e
// registra a mensagem com `origem='humano'`. Ela valida o tenant por dentro,
// com `tenant_valido()` — conferido no banco.

export async function POST(req: Request) {
  try {
    const { tenant_id } = await resolverTenant(req);

    const corpo = (await req.json().catch(() => ({}))) as {
      lead_id?: string;
      mensagem?: string;
    };
    const mensagem = (corpo.mensagem ?? "").trim();
    if (!corpo.lead_id || !mensagem) {
      return NextResponse.json(
        { erro: "informe lead_id e mensagem" },
        { status: 400 }
      );
    }

    const sb = await getSupabaseServer();
    const { data, error } = await sb.rpc("painel_responder", {
      p_lead: corpo.lead_id,
      p_mensagem: mensagem,
      p_tenant: tenant_id,
    });
    if (error) throw error;

    const r = (data ?? [])[0] as
      | { ok: boolean; telefone: string | null; instancia: string | null }
      | undefined;
    if (!r?.ok || !r.telefone) {
      return NextResponse.json(
        { erro: "Cliente não encontrada nesta clínica." },
        { status: 404 }
      );
    }
    if (!r.instancia) {
      // Gravada, mas sem canal para sair. A tela mostra a mensagem marcada
      // como não enviada, e o texto diz o que fazer.
      return NextResponse.json(
        {
          gravada: true,
          erro: "WhatsApp não conectado. A mensagem ficou registrada, mas não saiu — conecte em Configurações → Conexão.",
        },
        { status: 502 }
      );
    }

    try {
      const env = await enviarTexto(r.instancia, r.telefone, mensagem);
      return NextResponse.json(
        { ok: true, gravada: true, id: env.id },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (e) {
      registrarErro("responder/evolution", e);
      const msg =
        e instanceof EvolutionErro
          ? e.message
          : "Não foi possível falar com o WhatsApp";
      // 502 com `gravada: true`: a tela precisa saber que a mensagem EXISTE na
      // conversa, senão ela some da lista otimista e a pessoa reescreve tudo.
      return NextResponse.json(
        { gravada: true, erro: `${msg}. A mensagem ficou registrada, mas não saiu.` },
        { status: 502 }
      );
    }
  } catch (e) {
    registrarErro("responder", e);
    return respostaErroTenant(e);
  }
}
