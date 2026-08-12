import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Assina os arquivos de mídia das conversas.
//
// O bucket `midia-conversas` é PRIVADO: são fotos que clientes mandaram para
// uma clínica de estética — muitas de corpo, algumas de área tratada. URL
// pública ali significaria que qualquer um com o link vê a foto de uma
// paciente, para sempre e sem login. Por isso a leitura passa por aqui, com
// service role, atrás do middleware que exige sessão em /api/painel/*.

const BUCKET = "midia-conversas";

/** 10 minutos. Curto de propósito: o link vaza junto com qualquer print da
 *  aba de rede, e o custo de reassinar é uma requisição. */
const VALIDADE_S = 600;

/** Um lote é uma conversa aberta (50 mensagens por página do chat). O teto
 *  existe para que a rota não vire um assinador em massa do bucket inteiro. */
const MAX_CAMINHOS = 200;

export async function POST(req: Request) {
  let caminhos: unknown;
  try {
    ({ caminhos } = (await req.json()) as { caminhos?: unknown });
  } catch {
    return NextResponse.json({ erro: "corpo_invalido" }, { status: 400 });
  }

  if (!Array.isArray(caminhos)) {
    return NextResponse.json({ erro: "caminhos_invalidos" }, { status: 400 });
  }

  // Só strings, sem duplicata e sem subir de diretório. `..` num caminho
  // assinado é o caminho clássico para ler o que não era para ser lido.
  const limpos = [
    ...new Set(
      caminhos.filter(
        (c): c is string =>
          typeof c === "string" &&
          c.length > 0 &&
          c.length < 512 &&
          !c.includes("..")
      )
    ),
  ].slice(0, MAX_CAMINHOS);

  if (limpos.length === 0) return NextResponse.json({ urls: {} });

  try {
    const db = getSupabaseAdmin();
    // UMA chamada para o lote inteiro. Assinar por bolha faria uma conversa
    // com 30 fotos disparar 30 requisições ao abrir.
    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUrls(limpos, VALIDADE_S);

    if (error) return NextResponse.json({ erro: "erro_interno" }, { status: 500 });

    const urls: Record<string, string> = {};
    for (const item of data ?? []) {
      // O Supabase devolve `path` de volta e um `error` por item — arquivo
      // que sumiu do bucket não pode derrubar os outros 29.
      if (item.signedUrl && item.path) urls[item.path] = item.signedUrl;
    }
    return NextResponse.json(
      { urls, expiraEm: VALIDADE_S },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ erro: "erro_interno" }, { status: 500 });
  }
}
