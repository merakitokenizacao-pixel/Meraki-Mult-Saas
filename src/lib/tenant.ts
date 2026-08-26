// Contrato do tenant, compartilhado entre navegador e servidor.
// Sem I/O e sem "server-only": os dois lados importam daqui.

/** Uma clínica desta conta, como `minhas_clinicas()` devolve. */
export interface Clinica {
  tenant_id: string;
  slug: string;
  nome: string;
  papel: string;
}

/**
 * Cabeçalho por onde o navegador INFORMA qual clínica está vendo.
 *
 * Informa — não escolhe. O valor é um palpite do cliente até o banco confirmar
 * com `tenant_valido()`; ver src/lib/tenant-server.ts e a regra de ouro no
 * CLAUDE.md. Vai em cabeçalho, e não no corpo, para servir GET e POST do mesmo
 * jeito e não obrigar toda rota de leitura a ganhar um corpo só por causa disso.
 */
export const CABECALHO_TENANT = "x-meraki-tenant";

/** Onde a escolha do seletor persiste entre navegações. */
export const TENANT_STORAGE_KEY = "meraki-tenant";

/** Formato de uuid — barra lixo antes de gastar uma ida ao banco. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehTenantId(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}
