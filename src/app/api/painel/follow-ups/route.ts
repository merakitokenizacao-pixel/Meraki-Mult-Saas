import { NextResponse } from "next/server";
import { listarFollowUps } from "@/lib/followup-db";
import {
  resolverTenant,
  respostaErroTenant,
} from "@/lib/tenant-server";

export const dynamic = "force-dynamic";

// Só leitura, mas com service_role — que ignora RLS. Sessão diz QUEM é;
// `resolverTenant()` diz QUAL clínica.
export async function GET(req: Request) {
  try {
    const { tenant_id } = await resolverTenant(req);
    return NextResponse.json(
      { followups: await listarFollowUps(tenant_id) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return respostaErroTenant(e);
  }
}
