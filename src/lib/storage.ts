// Caminhos no bucket de mídia das conversas. Lógica pura — sem I/O, testável.
//
// Formato:  {slug-do-tenant}/{telefone}/{msgId}.{ext}
//
// O slug na primeira pasta é o que torna o escopo verificável por PREFIXO, sem
// consultar o banco a cada arquivo: quem assina a URL sabe o slug da sessão e
// compara. Antes o prefixo era o nome de uma clínica fixa, o que só funciona
// enquanto existe uma.

export const BUCKET_MIDIA = "midia-conversas";

/** Slug de tenant: minúsculas, dígitos e hífen. É o que o banco já grava. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function ehSlug(v: unknown): v is string {
  return typeof v === "string" && SLUG.test(v);
}

/**
 * O caminho está dentro da pasta deste tenant?
 *
 * Compara a PRIMEIRA PASTA inteira, não `startsWith(slug)`. Um prefixo solto
 * aprovaria `lins-antiga/...` para o tenant `lins` — dois tenants distintos
 * cujo slug de um começa com o do outro deixariam de estar separados.
 */
export function dentroDoTenant(caminho: string, slug: string): boolean {
  if (!ehSlug(slug)) return false;
  if (typeof caminho !== "string" || caminho.length === 0) return false;
  // Barra no começo faria a primeira pasta ser a string vazia.
  if (caminho.startsWith("/") || caminho.includes("..")) return false;
  const barra = caminho.indexOf("/");
  // Sem barra é arquivo na raiz do bucket: não pertence a tenant nenhum.
  if (barra <= 0) return false;
  return caminho.slice(0, barra) === slug;
}

/** Monta o caminho de uma mídia. Fonte única do formato. */
export function caminhoMidia(
  slug: string,
  telefone: string,
  msgId: string,
  extensao: string
): string {
  const tel = telefone.replace(/[^0-9]/g, "");
  const ext = extensao.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `${slug}/${tel}/${msgId}.${ext}`;
}
