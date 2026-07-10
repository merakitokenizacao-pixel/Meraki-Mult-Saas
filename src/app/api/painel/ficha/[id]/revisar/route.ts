import { NextResponse } from "next/server";
import { isTokenValido } from "@/lib/ficha";
import { revisarFicha } from "@/lib/ficha-db";

export const dynamic = "force-dynamic";

// POST /api/painel/ficha/<id>/revisar — marca a ficha como revisada.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isTokenValido(id)) {
    return NextResponse.json({ erro: "id_invalido" }, { status: 400 });
  }

  try {
    const ok = await revisarFicha(id);
    // ok=false: já estava revisada ou não estava preenchida. Idempotente.
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ erro: "erro_interno" }, { status: 500 });
  }
}
