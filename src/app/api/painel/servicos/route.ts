import { NextResponse } from "next/server";
import {
  listarCatalogoServicos,
  listarPromocoesPreco,
} from "@/lib/servicos-db";
import {
  resolverTenant,
  respostaErroTenant,
} from "@/lib/tenant-server";
import { registrarErro } from "@/lib/log-erro";

export const dynamic = "force-dynamic";

// Catálogo de serviços da clínica, lido de `documentos` — a MESMA base que
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
    // O comportamento da resposta NÃO muda: continua 500 genérico, sem vazar
    // mensagem do Postgres. O que muda é o terminal deixar de ficar mudo.
    registrarErro("servicos", e);
    return respostaErroTenant(e);
  }
}
