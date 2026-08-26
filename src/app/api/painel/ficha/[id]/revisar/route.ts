import { NextResponse } from "next/server";
import { isTokenValido } from "@/lib/ficha";
import { revisarFicha } from "@/lib/ficha-db";
import {
  resolverTenant,
  respostaErroTenant,
} from "@/lib/tenant-server";

export const dynamic = "force-dynamic";

// POST /api/painel/ficha/<id>/revisar — marca a ficha como revisada.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isTokenValido(id)) {
    return NextResponse.json({ erro: "id_invalido" }, { status: 400 });
  }

  try {
    // O id vem da URL. Sem o tenant no WHERE, marcar como revisada a ficha de
    // outra clínica seria só questão de conhecer o uuid.
    const { tenant_id } = await resolverTenant(req);
    const ok = await revisarFicha(tenant_id, id);
    // ok=false: já estava revisada ou não estava preenchida. Idempotente.
    return NextResponse.json({ ok });
  } catch (e) {
    return respostaErroTenant(e);
  }
}
