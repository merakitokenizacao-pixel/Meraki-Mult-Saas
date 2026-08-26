import { NextResponse } from "next/server";
import { listarPromocoes, criarPromocao } from "@/lib/promocao-db";
import { validarPromocao, type CamposPromocao } from "@/lib/promocao";
import {
  resolverTenant,
  respostaErroTenant,
} from "@/lib/tenant-server";

export const dynamic = "force-dynamic";

// Leitura e escrita com service_role, que IGNORA a RLS — por isso o tenant
// vem de `resolverTenant()` antes de qualquer consulta, e não do corpo. O
// middleware já exige sessão em /api/painel/* (401 sem login), mas sessão
// diz QUEM é, não QUAL clínica: as duas coisas precisam ser checadas.

export async function GET(req: Request) {
  try {
    const { tenant_id } = await resolverTenant(req);
    return NextResponse.json(
      { promocoes: await listarPromocoes(tenant_id) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return respostaErroTenant(e);
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

  // Revalida no servidor: as travas de texto (travessão/emoji) não podem
  // depender do cliente — o que passa daqui vai direto para o WhatsApp.
  const erros = validarPromocao(campos);
  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  try {
    return NextResponse.json({ promocao: await criarPromocao(tenant, campos) });
  } catch {
    return NextResponse.json({ erro: "erro_interno" }, { status: 500 });
  }
}

export { lerCampos };
