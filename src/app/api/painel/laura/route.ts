import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  resolverTenant,
  respostaErroTenant,
} from "@/lib/tenant-server";

export const dynamic = "force-dynamic";

// Saúde da Laura, derivada do que ela DEIXA no banco.
//
// Não existe tabela de configuração do agente: horário de atendimento, tom e
// prompt vivem no n8n, fora deste repositório. O que dá para responder aqui é
// "ela está trabalhando?", e isso se lê nas mensagens que ela grava.
//
// Server-side por causa do volume: são 6.500+ linhas em `conversas`, e contar
// no navegador significaria baixar tudo — o teto de 1.000 do PostgREST cortaria
// em silêncio e a conta sairia errada sem avisar (ver `paginar.ts`).

export async function GET(req: Request) {
  try {
    // Todas as contagens abaixo saem por service_role, que ignora RLS. Sem o
    // tenant no WHERE, "última resposta da Laura" viria da clínica mais
    // movimentada, não desta.
    const { tenant_id } = await resolverTenant(req);
    const db = getSupabaseAdmin();

    // `head: true` traz só o total, sem uma única linha no corpo.
    const [ultAgente, ultCliente, pausados, total, porQuem] = await Promise.all([
      db
        .from("conversas")
        .select("enviado_em")
        .eq("tenant_id", tenant_id)
        .eq("origem", "agente")
        .order("enviado_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("conversas")
        .select("enviado_em")
        .eq("tenant_id", tenant_id)
        .eq("origem", "cliente")
        .order("enviado_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant_id)
        .eq("ia_pausada", true),
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant_id),
      // Quem pausou. `.limit()` explícito porque o PostgREST corta em 1.000
      // SEM avisar — e esta consulta vira uma CONTAGEM logo abaixo, então o
      // corte não encurtaria uma lista, faria o número mentir.
      db
        .from("leads")
        .select("pausada_por")
        .eq("tenant_id", tenant_id)
        .eq("ia_pausada", true)
        .limit(5000),
    ]);

    const motivos = new Map<string, number>();
    for (const l of porQuem.data ?? []) {
      const k = (l.pausada_por ?? "não registrado").toString();
      motivos.set(k, (motivos.get(k) ?? 0) + 1);
    }

    return NextResponse.json(
      {
        ultimaRespostaAgente: ultAgente.data?.enviado_em ?? null,
        ultimaMensagemCliente: ultCliente.data?.enviado_em ?? null,
        pausados: pausados.count ?? 0,
        totalLeads: total.count ?? 0,
        porQuem: [...motivos.entries()]
          .map(([quem, qtd]) => ({ quem, qtd }))
          .sort((a, b) => b.qtd - a.qtd),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return respostaErroTenant(e);
  }
}
