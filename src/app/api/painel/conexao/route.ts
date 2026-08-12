import { NextResponse } from "next/server";
import { EvolutionErro, estadoConexao, qrConexao } from "@/lib/evolution";

export const dynamic = "force-dynamic";

// Estado da conexão do WhatsApp e pedido de QR.
//
// Server-side por obrigação: `EVOLUTION_API_KEY` não tem `NEXT_PUBLIC_` porque
// ela manda mensagem em nome da clínica. Chamar a Evolution do navegador
// colocaria a chave no bundle. O middleware já exige sessão em /api/painel/*.

export async function GET() {
  try {
    return NextResponse.json(await estadoConexao(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const erro = e instanceof EvolutionErro ? e : null;
    // Falar do estado é diferente de falhar: quando não dá para perguntar, a
    // resposta honesta é "não sei", não "desconectado" — dizer que caiu sem
    // ter checado faria a dona correr atrás de um problema que não existe.
    return NextResponse.json(
      { erro: erro?.message ?? "Não foi possível consultar o WhatsApp" },
      { status: erro?.status === 500 ? 500 : 502 }
    );
  }
}

/** POST = pedir QR novo. Não desconecta nada; só solicita o código. */
export async function POST() {
  try {
    return NextResponse.json(await qrConexao(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const erro = e instanceof EvolutionErro ? e : null;
    return NextResponse.json(
      { erro: erro?.message ?? "Não foi possível pedir o QR" },
      { status: erro?.status === 500 ? 500 : 502 }
    );
  }
}
