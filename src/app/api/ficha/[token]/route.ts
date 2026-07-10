import { NextResponse } from "next/server";
import { isTokenValido, parseRespostas } from "@/lib/ficha";
import { submitFicha } from "@/lib/ficha-db";

export const dynamic = "force-dynamic";

// Submissão da ficha pela paciente. Único ponto de escrita em
// `fichas_avaliacao` vindo da web. Tudo aqui é servidor: a service role e as
// respostas nunca chegam ao browser.
//
// LGPD: não logamos corpo de requisição nem mensagens de erro do Postgres —
// as respostas são dado de saúde.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!isTokenValido(token)) {
    return NextResponse.json({ erro: "nao_encontrada" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "payload_invalido" }, { status: 400 });
  }

  // Revalida no servidor: o cliente pode ter burlado a validação do form.
  const parsed = parseRespostas(body);
  if (!parsed.ok) {
    return NextResponse.json({ erros: parsed.erros }, { status: 400 });
  }

  try {
    // Os `alertas` são derivados aqui dentro (submitFicha → calcularAlertas);
    // nada que o cliente mande influencia o cálculo.
    const res = await submitFicha(token, parsed.data);

    if (!res.ok) {
      const status = res.motivo === "nao_encontrada" ? 404 : 409;
      return NextResponse.json({ erro: res.motivo }, { status });
    }

    return NextResponse.json(
      { ok: true, dataAgendamento: res.dataAgendamento },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ erro: "erro_interno" }, { status: 500 });
  }
}
