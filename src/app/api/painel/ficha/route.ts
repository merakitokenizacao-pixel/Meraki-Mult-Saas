import { NextResponse } from "next/server";
import { isTokenValido } from "@/lib/ficha";
import { getFichasByLead } from "@/lib/ficha-db";
import {
  resolverTenant,
  respostaErroTenant,
} from "@/lib/tenant-server";

export const dynamic = "force-dynamic";

// GET /api/painel/ficha?lead_id=<uuid>
// Fichas de um lead, para a seção no detalhe do cliente. Sai por service_role,
// que ignora a RLS — então o escopo é feito aqui, e é dado de SAÚDE: sessão
// diz quem é, `resolverTenant()` diz de qual clínica, e o par tenant+lead no
// WHERE impede que um uuid de lead alheio devolva a ficha dele.
export async function GET(req: Request) {
  const leadId = new URL(req.url).searchParams.get("lead_id") ?? "";
  if (!isTokenValido(leadId)) {
    return NextResponse.json({ erro: "lead_invalido" }, { status: 400 });
  }

  try {
    const { tenant_id } = await resolverTenant(req);
    const fichas = await getFichasByLead(tenant_id, leadId);
    return NextResponse.json(
      { fichas },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return respostaErroTenant(e);
  }
}
