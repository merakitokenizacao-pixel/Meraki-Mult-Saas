import "server-only";

// Envio de WhatsApp pela Evolution API.
//
// ⚠️ SÓ SERVIDOR. As variáveis não têm `NEXT_PUBLIC_` de propósito: a chave
// manda mensagem em nome da clínica. O envio antigo chamava um webhook do n8n
// direto do navegador, com a URL no bundle — qualquer um abria o DevTools, lia
// o endereço e disparava WhatsApp pela clínica, sem login e sem rastro.
//
// Chamar do servidor também elimina o CORS por construção: a requisição deixa
// de ser cross-origin e não existe preflight para o host recusar.

export class EvolutionErro extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "EvolutionErro";
  }
}

function config() {
  const url = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const key = process.env.EVOLUTION_API_KEY;
  const instancia = process.env.EVOLUTION_INSTANCE;
  if (!url || !key || !instancia) {
    throw new EvolutionErro(
      "Evolution não configurada (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE)",
      500
    );
  }
  return { url, key, instancia };
}

/** Só dígitos, com DDI 55 — mesmo formato que o n8n usa como chave do lead. */
export function normalizarTelefone(bruto: string): string {
  const so = (bruto || "").replace(/\D/g, "");
  if (!so) return "";
  return so.startsWith("55") ? so : `55${so}`;
}

/** Timeout próprio: sem isso, host fora do ar prende a requisição até o limite
 *  da plataforma e a tela fica girando sem dizer nada. */
const TIMEOUT_MS = 20_000;

export async function enviarTexto(
  telefone: string,
  texto: string
): Promise<{ id: string | null }> {
  const { url, key, instancia } = config();
  const numero = normalizarTelefone(telefone);
  if (!numero) throw new EvolutionErro("Telefone inválido", 400);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let r: Response;
  try {
    r = await fetch(
      `${url}/message/sendText/${encodeURIComponent(instancia)}`,
      {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ number: numero, text: texto }),
        signal: ctrl.signal,
        cache: "no-store",
      }
    );
  } catch (e) {
    // Foi assim que o envio quebrou: o host parou de aceitar conexão e o erro
    // chegava no navegador como "Failed to fetch", sem dizer de onde vinha.
    const abortou = (e as Error).name === "AbortError";
    throw new EvolutionErro(
      abortou
        ? "O WhatsApp demorou demais para responder"
        : "Não foi possível falar com o WhatsApp",
      504
    );
  } finally {
    clearTimeout(t);
  }

  const corpo = await r.text();
  if (!r.ok) {
    // O corpo pode trazer detalhe útil (número inválido, instância desconectada).
    throw new EvolutionErro(
      `WhatsApp recusou o envio (HTTP ${r.status})`,
      r.status === 401 || r.status === 403 ? 502 : r.status
    );
  }
  try {
    const j = JSON.parse(corpo) as { key?: { id?: string } };
    return { id: j.key?.id ?? null };
  } catch {
    return { id: null };
  }
}
