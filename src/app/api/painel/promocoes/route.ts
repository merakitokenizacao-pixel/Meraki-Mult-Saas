import { NextResponse } from "next/server";
import { listarPromocoes, criarPromocao } from "@/lib/promocao-db";
import { validarPromocao, type CamposPromocao } from "@/lib/promocao";

export const dynamic = "force-dynamic";

// `promocoes` tem RLS ligada e nenhuma policy: só service role lê/escreve.
// O middleware já exige sessão em /api/painel/* (401 sem login).

export async function GET() {
  try {
    return NextResponse.json(
      { promocoes: await listarPromocoes() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ erro: "erro_interno" }, { status: 500 });
  }
}

/** Normaliza o corpo cru em campos da tabela (vazio → null onde a coluna aceita). */
function lerCampos(body: unknown): CamposPromocao {
  const b = (body ?? {}) as Record<string, unknown>;
  const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const opc = (v: unknown) => {
    const s = txt(v);
    return s.length > 0 ? s : null;
  };
  const dia = b.dia_semana;
  return {
    titulo: txt(b.titulo),
    descricao: txt(b.descricao),
    procedimento: opc(b.procedimento),
    valor_promocional: txt(b.valor_promocional),
    condicao: opc(b.condicao),
    dia_semana:
      dia === null || dia === undefined || dia === "" ? null : Number(dia),
    valida_ate: opc(b.valida_ate),
    ativa: b.ativa !== false,
    anuncio_ativo: b.anuncio_ativo === true,
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "payload_invalido" }, { status: 400 });
  }

  const campos = lerCampos(body);

  // Revalida no servidor: as travas de texto (travessão/emoji) não podem
  // depender do cliente — o que passa daqui vai direto para o WhatsApp.
  const erros = validarPromocao(campos);
  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  try {
    return NextResponse.json({ promocao: await criarPromocao(campos) });
  } catch {
    return NextResponse.json({ erro: "erro_interno" }, { status: 500 });
  }
}

export { lerCampos };
