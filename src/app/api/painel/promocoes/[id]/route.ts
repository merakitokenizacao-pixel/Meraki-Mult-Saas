import { NextResponse } from "next/server";
import {
  atualizarPromocao,
  alternarAtiva,
  excluirPromocao,
} from "@/lib/promocao-db";
import { isTokenValido } from "@/lib/ficha";
import { validarPromocao, type CamposPromocao } from "@/lib/promocao";
import {
  resolverTenant,
  respostaErroTenant,
} from "@/lib/tenant-server";

// O `id` vem da URL, ou seja, do cliente. Validar a sessão não basta: sem o
// tenant no WHERE, conhecer o uuid de uma promoção de outra clínica bastaria
// para reescrevê-la. Quem faz o par id+tenant é o promocao-db.

export const dynamic = "force-dynamic";

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

/** PUT = salvar o formulário inteiro. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isTokenValido(id)) {
    return NextResponse.json({ erro: "id_invalido" }, { status: 400 });
  }

  let tenant: string;
  try {
    tenant = (await resolverTenant(req)).tenant_id;
  } catch (e) {
    return respostaErroTenant(e);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "payload_invalido" }, { status: 400 });
  }

  const campos = lerCampos(body);
  const erros = validarPromocao(campos);
  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  try {
    return NextResponse.json({
      promocao: await atualizarPromocao(tenant, id, campos),
    });
  } catch {
    return NextResponse.json({ erro: "erro_interno" }, { status: 500 });
  }
}

/**
 * DELETE = apaga de vez.
 *
 * ⚠️ O PATCH continua sendo o caminho normal: "Tirar do ar" grava `ativa=false`
 * e preserva o histórico. Este aqui existe para o erro de cadastro — promoção
 * criada sem querer, que nunca deveria ter existido. A confirmação na tela é
 * quem explica que a agente para de oferecer na hora.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isTokenValido(id)) {
    return NextResponse.json({ erro: "id_invalido" }, { status: 400 });
  }
  let tenant: string;
  try {
    tenant = (await resolverTenant(req)).tenant_id;
  } catch (e) {
    return respostaErroTenant(e);
  }
  try {
    await excluirPromocao(tenant, id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erro: "erro_interno" }, { status: 500 });
  }
}

/**
 * PATCH = atalho da lista para ligar/desligar sem abrir o formulário.
 * Nunca deleta: promoção encerrada fica com ativa=false (histórico).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isTokenValido(id)) {
    return NextResponse.json({ erro: "id_invalido" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "payload_invalido" }, { status: 400 });
  }

  let tenant: string;
  try {
    tenant = (await resolverTenant(req)).tenant_id;
  } catch (e) {
    return respostaErroTenant(e);
  }

  const ativa = (body as { ativa?: unknown })?.ativa;
  if (typeof ativa !== "boolean") {
    return NextResponse.json({ erro: "ativa_invalida" }, { status: 400 });
  }

  try {
    await alternarAtiva(tenant, id, ativa);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erro: "erro_interno" }, { status: 500 });
  }
}
