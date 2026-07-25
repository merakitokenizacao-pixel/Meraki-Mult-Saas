import { NextResponse } from "next/server";
import { listarFollowUps } from "@/lib/followup-db";

export const dynamic = "force-dynamic";

// Só leitura. O middleware já exige sessão em /api/painel/* (401 sem login).
export async function GET() {
  try {
    return NextResponse.json(
      { followups: await listarFollowUps() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ erro: "erro_interno" }, { status: 500 });
  }
}
