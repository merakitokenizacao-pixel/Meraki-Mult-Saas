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

// ── Estado da conexão ─────────────────────────────────────────────────
// A dona não tem como saber que o WhatsApp caiu até uma cliente reclamar que
// ninguém respondeu. Isso dá o estado antes de virar prejuízo.

export type EstadoConexao = "conectado" | "conectando" | "desconectado";

export interface StatusEvolution {
  estado: EstadoConexao;
  /** O que a Evolution devolveu, cru — útil quando ela inventa um estado novo. */
  bruto: string;
  instancia: string;
}

/** `open` = pareado e recebendo. `connecting` = esperando o QR ser lido.
 *  `close` = caiu. Qualquer outra coisa conta como desconectado: na dúvida, o
 *  alarme falso custa menos que o silêncio. */
function traduzirEstado(bruto: string): EstadoConexao {
  if (bruto === "open") return "conectado";
  if (bruto === "connecting") return "conectando";
  return "desconectado";
}

async function chamar(caminho: string, timeout = 15_000): Promise<Response> {
  const { url, key } = config();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(`${url}${caminho}`, {
      headers: { apikey: key },
      signal: ctrl.signal,
      cache: "no-store",
    });
  } catch (e) {
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
}

export async function estadoConexao(): Promise<StatusEvolution> {
  const { instancia } = config();
  const r = await chamar(
    `/instance/connectionState/${encodeURIComponent(instancia)}`
  );
  const corpo = await r.text();
  if (!r.ok) {
    throw new EvolutionErro(
      `WhatsApp não respondeu o estado (HTTP ${r.status})`,
      r.status === 401 || r.status === 403 ? 502 : r.status
    );
  }
  let bruto = "desconhecido";
  try {
    const j = JSON.parse(corpo) as { instance?: { state?: string } };
    bruto = j.instance?.state ?? "desconhecido";
  } catch {
    /* corpo fora do formato: fica "desconhecido", que já cai em desconectado */
  }
  return { estado: traduzirEstado(bruto), bruto, instancia };
}

/**
 * Pede um QR novo para reparear.
 *
 * ⚠️ Isto NÃO desconecta nada — só pede o código. Se a instância já estiver
 * conectada, a Evolution costuma devolver o estado em vez do QR, e é por isso
 * que a resposta traz os dois campos: quem chama decide o que mostrar.
 */
export async function qrConexao(): Promise<{
  qr: string | null;
  estado: EstadoConexao;
}> {
  const { instancia } = config();
  const r = await chamar(`/instance/connect/${encodeURIComponent(instancia)}`);
  const corpo = await r.text();
  if (!r.ok) {
    throw new EvolutionErro(
      `WhatsApp não devolveu o QR (HTTP ${r.status})`,
      r.status === 401 || r.status === 403 ? 502 : r.status
    );
  }
  try {
    const j = JSON.parse(corpo) as {
      base64?: string;
      code?: string;
      instance?: { state?: string };
    };
    // `base64` já vem como data: URI na maioria das versões; quando vem só o
    // payload cru, o cliente não tem como desenhar — devolve null em vez de
    // um <img> quebrado.
    const b64 = j.base64 ?? null;
    const qr = b64 && b64.startsWith("data:") ? b64 : b64 ? `data:image/png;base64,${b64}` : null;
    return { qr, estado: traduzirEstado(j.instance?.state ?? "connecting") };
  } catch {
    return { qr: null, estado: "conectando" };
  }
}
