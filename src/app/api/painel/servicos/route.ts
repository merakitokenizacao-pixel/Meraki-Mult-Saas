import { NextResponse } from "next/server";
import {
  listarCatalogoServicos,
  listarPromocoesPreco,
} from "@/lib/servicos-db";
import {
  resolverTenant,
  respostaErroTenant,
} from "@/lib/tenant-server";

export const dynamic = "force-dynamic";

// Catálogo de serviços da clínica, lido de `documentos_lins` — a MESMA base que
// a Laura consulta no WhatsApp. Se o preço do CRM viesse de outro lugar, a
// agente diria um valor e a tela mostraria outro.
//
// Server-side com service_role, que ignora a RLS — daí o tenant vir de
// `resolverTenant()`. Catálogo é dado por clínica: sem o filtro, uma veria o
// preço da outra.

export async function GET(req: Request) {
  try {
    const { tenant_id } = await resolverTenant(req);
    const [servicos, promocoes] = await Promise.all([
      listarCatalogoServicos(tenant_id),
      listarPromocoesPreco(tenant_id),
    ]);
    return NextResponse.json(
      { servicos, promocoes },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return respostaErroTenant(e);
  }
}
