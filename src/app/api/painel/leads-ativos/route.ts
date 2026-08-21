import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Quem de fato FALOU com a clínica.
//
// A dona disparou mensagem para a lista antiga de contatos dela. Esses números
// entraram em `leads`, e o painel passou a contá-los como "clientes captados" —
// 509 nos últimos 7 dias, dos quais só 37 responderam. A taxa de conversão caiu
// para 1% por causa do denominador, não por causa do atendimento.
//
// Contato que recebeu disparo e ficou mudo não é lead captado: a clínica falou
// com ele, ele não falou com a clínica. O sinal é ter pelo menos UMA linha em
// `conversas` com origem 'cliente'.
//
// Server-side por causa do volume: são 6.500+ linhas em `conversas`, e o
// PostgREST corta em 1.000 SEM avisar — a lista voltaria incompleta e a métrica
// mentiria de novo, para o outro lado.

const PAGINA = 1000;
const TETO_PAGINAS = 50;

export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const ids = new Set<string>();

    for (let p = 0; p < TETO_PAGINAS; p++) {
      const { data, error } = await db
        .from("conversas")
        .select("lead_id")
        .eq("origem", "cliente")
        // Ordenação determinística: sem ela o Postgres pode devolver ordem
        // diferente a cada página, duplicando umas linhas e perdendo outras.
        .order("id", { ascending: true })
        .range(p * PAGINA, p * PAGINA + PAGINA - 1);
      if (error) throw error;
      for (const c of data ?? []) if (c.lead_id) ids.add(c.lead_id as string);
      // Página curta = acabou.
      if (!data || data.length < PAGINA) break;
    }

    return NextResponse.json(
      { ids: [...ids] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ erro: "erro_interno" }, { status: 500 });
  }
}
