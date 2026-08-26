import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  resolverTenant,
  respostaErroTenant,
} from "@/lib/tenant-server";
import { BUCKET_MIDIA, dentroDoTenant } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Assina os arquivos de mídia das conversas.
//
// O bucket `midia-conversas` é PRIVADO: são fotos que clientes mandaram para
// uma clínica de estética — muitas de corpo, algumas de área tratada. URL
// pública ali significaria que qualquer um com o link vê a foto de uma
// paciente, para sempre e sem login. Por isso a leitura passa por aqui, com
// service role, atrás do middleware que exige sessão em /api/painel/*.
//
// ⚠️ Esta rota ASSINA o que o cliente pedir. Sessão não basta: o corpo é uma
// lista de caminhos, e service_role assina qualquer objeto do bucket. Sem a
// trava de prefixo abaixo, uma conta autenticada de uma clínica montaria a
// lista com o caminho da mídia de OUTRA e receberia URLs válidas para as
// fotos das pacientes dela.
//
// O prefixo permitido é o slug do tenant DA SESSÃO — nunca um slug recebido
// do cliente, que seria só pedir educadamente o mesmo vazamento.

const BUCKET = BUCKET_MIDIA;

/** 10 minutos. Curto de propósito: o link vaza junto com qualquer print da
 *  aba de rede, e o custo de reassinar é uma requisição. */
const VALIDADE_S = 600;

/** Um lote é uma conversa aberta (50 mensagens por página do chat). O teto
 *  existe para que a rota não vire um assinador em massa do bucket inteiro. */
const MAX_CAMINHOS = 200;

export async function POST(req: Request) {
  let slug: string;
  try {
    slug = (await resolverTenant(req)).slug;
  } catch (e) {
    return respostaErroTenant(e);
  }

  let caminhos: unknown;
  try {
    ({ caminhos } = (await req.json()) as { caminhos?: unknown });
  } catch {
    return NextResponse.json({ erro: "corpo_invalido" }, { status: 400 });
  }

  if (!Array.isArray(caminhos)) {
    return NextResponse.json({ erro: "caminhos_invalidos" }, { status: 400 });
  }

  // Só strings, sem duplicata, sem subir de diretório e DENTRO da pasta do
  // tenant. `..` num caminho assinado é o jeito clássico de ler o que não era
  // para ser lido; o prefixo do slug é o que fecha o resto.
  //
  // Caminho fora do escopo é descartado em silêncio, sem 403: responder
  // "existe, mas não é sua" confirmaria a existência do arquivo para quem
  // estivesse tentando adivinhar.
  const limpos = [
    ...new Set(
      caminhos.filter(
        (c): c is string =>
          typeof c === "string" &&
          c.length > 0 &&
          c.length < 512 &&
          !c.includes("..") &&
          dentroDoTenant(c, slug)
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
