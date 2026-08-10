import { NextResponse } from "next/server";
import {
  listarCatalogoServicos,
  listarPromocoesPreco,
} from "@/lib/servicos-db";

export const dynamic = "force-dynamic";

// Catálogo de serviços da clínica, lido de `documentos_lins` — a MESMA base que
// a Laura consulta no WhatsApp. Se o preço do CRM viesse de outro lugar, a
// agente diria um valor e a tela mostraria outro.
//
// Precisa ser server-side: `documentos_lins` e `promocoes` têm RLS ligada sem
// policy, então só service role lê. O middleware exige sessão em /api/painel/*.

export async function GET() {
  try {
    const [servicos, promocoes] = await Promise.all([
      listarCatalogoServicos(),
      listarPromocoesPreco(),
    ]);
    return NextResponse.json(
      { servicos, promocoes },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ erro: "erro_interno" }, { status: 500 });
  }
}
