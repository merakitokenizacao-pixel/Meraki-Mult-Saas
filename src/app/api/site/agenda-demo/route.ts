import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Agenda real da LINS, para o visitante do site consultar.
//
// É a única coisa desta página que o concorrente não consegue imitar: ele
// deixa arrastar cartão de mentira, aqui a pessoa consulta a agenda de
// produção e vê o horário sumir quando ninguém faz aquele procedimento.
//
// A DISPONIBILIDADE JÁ É PÚBLICA — qualquer um descobre perguntando à Laura no
// WhatsApp. O que não pode vazar é QUEM está marcado, e é por isso que a
// resposta é montada campo a campo em vez de repassada:
// `agenda_slots` devolve capacidade, ocupadas, código e motivo, e nada disso
// sai daqui. Vai só { data, hora }.

const DIAS_A_FRENTE = 14;
const MAX_HORARIOS = 5;

/** 30 requisições por minuto por IP. Memória do processo, não Redis: a rota é
 *  barata e o objetivo é conter script, não sobreviver a ataque — para isso a
 *  camada certa é a borda, não aqui. */
const TETO_POR_MINUTO = 30;
const JANELA_MS = 60_000;
const visitas = new Map<string, { n: number; ate: number }>();

function excedeu(ip: string): boolean {
  const agora = Date.now();
  const v = visitas.get(ip);
  if (!v || agora > v.ate) {
    visitas.set(ip, { n: 1, ate: agora + JANELA_MS });
    // Limpeza preguiçosa: sem isto o Map cresce para sempre num processo de
    // vida longa.
    if (visitas.size > 5000) {
      for (const [k, x] of visitas) if (agora > x.ate) visitas.delete(k);
    }
    return false;
  }
  v.n += 1;
  return v.n > TETO_POR_MINUTO;
}

/** Dia local em "YYYY-MM-DD". Nunca `toISOString()`: ele converte para UTC e
 *  às 21h de Brasília devolve o dia seguinte. */
function diaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "desconhecido";
  if (excedeu(ip)) {
    return NextResponse.json({ erro: "muitas_requisicoes" }, { status: 429 });
  }

  const url = new URL(req.url);
  const procedimento = (url.searchParams.get("procedimento") ?? "").trim().slice(0, 120);

  try {
    const db = getSupabaseAdmin();
    const hoje = new Date();
    const ate = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + DIAS_A_FRENTE);

    const [slots, procs] = await Promise.all([
      db.rpc("agenda_slots", {
        p_de: diaLocal(hoje),
        p_ate: diaLocal(ate),
        p_duracao_min: 60,
        p_servico: procedimento || null,
      }),
      db.from("procedimentos").select("nome").eq("ativo", true).order("nome").limit(200),
    ]);
    if (slots.error) throw slots.error;

    type Slot = { data: string; hora: number; livres: number };
    const horarios = ((slots.data ?? []) as Slot[])
      .filter((s) => s.livres > 0)
      // Campo a campo, de propósito: `capacidade`, `ocupadas`, `codigo` e
      // `motivo` dizem quanto a clínica está cheia, e isso não é da conta de
      // quem visita o site.
      .map((s) => ({ data: s.data, hora: s.hora }))
      .slice(0, MAX_HORARIOS);

    return NextResponse.json(
      {
        procedimentos: (procs.data ?? []).map((p) => p.nome as string),
        horarios,
      },
      {
        headers: {
          // 60s de cache: a agenda não muda a cada segundo e a página é
          // pública, então cada visitante não precisa de uma ida ao banco.
          "Cache-Control": "public, max-age=60, s-maxage=60",
        },
      }
    );
  } catch {
    return NextResponse.json({ erro: "erro_interno" }, { status: 500 });
  }
}
