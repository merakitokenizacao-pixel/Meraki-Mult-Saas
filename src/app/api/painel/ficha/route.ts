import { NextResponse } from "next/server";
import { isTokenValido } from "@/lib/ficha";
import { getFichasByLead } from "@/lib/ficha-db";

export const dynamic = "force-dynamic";

// GET /api/painel/ficha?lead_id=<uuid>
// Fichas de um lead, para a seção no detalhe do cliente. Server-side (service
// role) porque `fichas_avaliacao` tem RLS ligada. SEM auth — mesmo nível de
// exposição do resto do app; dívida da Etapa 7 (ver ficha-db.ts / CLAUDE.md).
export async function GET(req: Request) {
  const leadId = new URL(req.url).searchParams.get("lead_id") ?? "";
  if (!isTokenValido(leadId)) {
    return NextResponse.json({ erro: "lead_invalido" }, { status: 400 });
  }

  try {
    const fichas = await getFichasByLead(leadId);
    return NextResponse.json(
      { fichas },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ erro: "erro_interno" }, { status: 500 });
  }
}
