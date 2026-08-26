import { CABECALHO_TENANT, TENANT_STORAGE_KEY, ehTenantId } from "@/lib/tenant";

// `fetch` para as rotas de /api/painel/*, com a clínica escolhida no cabeçalho.
//
// Existe para que nenhuma chamada esqueça o cabeçalho. Esquecer não quebra a
// tela de quem tem UMA clínica — o servidor resolve o tenant sozinho nesse
// caso —, e é justamente isso que torna o esquecimento fácil de não notar:
// funciona no desenvolvimento e falha só na conta que atende duas.
//
// O valor é lido do localStorage a cada chamada, e não capturado uma vez, para
// que trocar de clínica no seletor valha já na próxima requisição.

/** A clínica escolhida, ou null (conta de uma clínica só). */
export function tenantEscolhido(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(TENANT_STORAGE_KEY);
    return ehTenantId(v) ? v : null;
  } catch {
    // Navegador com armazenamento bloqueado: segue sem escolha explícita.
    return null;
  }
}

export function guardarTenantEscolhido(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(TENANT_STORAGE_KEY, id);
    else window.localStorage.removeItem(TENANT_STORAGE_KEY);
  } catch {
    // Sem persistência a escolha vale só nesta aba. Melhor que quebrar.
  }
}

export function fetchPainel(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const tenant = tenantEscolhido();
  const headers = new Headers(init.headers);
  if (tenant) headers.set(CABECALHO_TENANT, tenant);
  return fetch(url, { ...init, headers });
}
