import "server-only";

// Evolution API — o provedor de WhatsApp.
//
// ⚠️ SÓ SERVIDOR. As variáveis não têm `NEXT_PUBLIC_` de propósito: a chave
// manda mensagem em nome da clínica. O envio antigo chamava um webhook do n8n
// direto do navegador, com a URL no bundle — qualquer um abria o DevTools, lia
// o endereço e disparava WhatsApp pela clínica, sem login e sem rastro.
//
// Chamar do servidor também elimina o CORS por construção: a requisição deixa
// de ser cross-origin e não existe preflight para o host recusar.
//
// ⚠️ A INSTÂNCIA VEM DO SLUG DO TENANT, nunca de escolha da clínica nem de
// variável de ambiente. `EVOLUTION_INSTANCE` sumiu daqui: com ela, o painel
// inteiro falava por UMA instância, e a segunda clínica mandaria mensagem pelo
// WhatsApp da primeira. Se a clínica pudesse escolher o nome, duas escolheriam
// o mesmo e uma sobrescreveria a outra na Evolution.

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
  if (!url || !key) {
    throw new EvolutionErro(
      "Evolution não configurada (EVOLUTION_API_URL, EVOLUTION_API_KEY)",
      500
    );
  }
  return { url, key };
}

/**
 * O nome da instância na Evolution, derivado do slug.
 *
 * Determinístico e sem espaço para colisão: o slug já é único por tenant no
 * banco. O prefixo existe para a instância ser reconhecível numa Evolution
 * compartilhada com outros produtos.
 */
export function instanciaDoSlug(slug: string): string {
  const limpo = (slug || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!limpo) throw new EvolutionErro("Clínica sem slug utilizável", 500);
  return `meraki-${limpo}`;
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

async function chamar(
  caminho: string,
  init: RequestInit = {},
  timeout = 15_000
): Promise<Response> {
  const { url, key } = config();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(`${url}${caminho}`, {
      ...init,
      headers: { apikey: key, ...(init.headers ?? {}) },
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

// ── Estado ──────────────────────────────────────────────────────────────────

export type EstadoConexao = "conectado" | "conectando" | "desconectado";

/** `open` = pareado e recebendo. `connecting` = esperando o QR ser lido.
 *  `close` = caiu. Qualquer outra coisa conta como desconectado: na dúvida, o
 *  alarme falso custa menos que o silêncio. */
function traduzirEstado(bruto: string): EstadoConexao {
  if (bruto === "open") return "conectado";
  if (bruto === "connecting") return "conectando";
  return "desconectado";
}

export interface StatusEvolution {
  estado: EstadoConexao;
  /** O que a Evolution devolveu, cru — útil quando ela inventa um estado novo. */
  bruto: string;
  numero: string | null;
}

export async function estadoConexao(
  instancia: string
): Promise<StatusEvolution> {
  const r = await chamar(
    `/instance/connectionState/${encodeURIComponent(instancia)}`
  );
  const corpo = await r.text();
  // 404 = a instância nem existe. Isso não é erro: é "desconectada", e é o
  // estado normal de uma clínica que ainda não conectou.
  if (r.status === 404) {
    return { estado: "desconectado", bruto: "inexistente", numero: null };
  }
  if (!r.ok) {
    throw new EvolutionErro(
      `WhatsApp não respondeu o estado (HTTP ${r.status})`,
      r.status === 401 || r.status === 403 ? 502 : r.status
    );
  }
  try {
    const j = JSON.parse(corpo) as {
      instance?: { state?: string; owner?: string; profileName?: string };
    };
    return {
      estado: traduzirEstado(j.instance?.state ?? "desconhecido"),
      bruto: j.instance?.state ?? "desconhecido",
      numero: numeroDoOwner(j.instance?.owner),
    };
  } catch {
    return { estado: "desconectado", bruto: "resposta ilegível", numero: null };
  }
}

/** `5561999998888@s.whatsapp.net` → `5561999998888`. */
function numeroDoOwner(owner?: string): string | null {
  if (!owner) return null;
  const so = owner.split("@")[0].replace(/\D/g, "");
  return so || null;
}

// ── Criar, apontar o webhook, parear ────────────────────────────────────────

/**
 * Cria a instância.
 *
 * ⚠️ INSTÂNCIA JÁ EXISTENTE NÃO É FALHA. A Evolution devolve 403/409 (varia
 * por versão) quando o nome já está em uso — e no nosso caso "já em uso"
 * significa "esta clínica já conectou uma vez", que é o caminho normal de
 * reconexão. Tratar como erro faria a tela recusar justamente quem só quer
 * parear de novo.
 */
export async function criarInstancia(
  instancia: string
): Promise<{ criada: boolean }> {
  const r = await chamar("/instance/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instanceName: instancia,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    }),
  });
  if (r.ok) return { criada: true };
  const corpo = (await r.text()).toLowerCase();
  const jaExiste =
    r.status === 403 ||
    r.status === 409 ||
    corpo.includes("already in use") ||
    corpo.includes("already exists");
  if (jaExiste) return { criada: false };
  throw new EvolutionErro(
    `Não foi possível criar a conexão (HTTP ${r.status})`,
    r.status === 401 || r.status === 403 ? 502 : r.status
  );
}

/**
 * Aponta o webhook para o n8n.
 *
 * Sem isto a instância pareia e fica muda: as mensagens chegam na Evolution e
 * não viram linha em `conversas`. Falhar aqui NÃO derruba a conexão — o QR
 * ainda serve —, mas o chamador precisa saber para registrar em `ultimo_erro`.
 */
export async function definirWebhook(
  instancia: string,
  url: string
): Promise<void> {
  const r = await chamar(`/webhook/set/${encodeURIComponent(instancia)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webhook: { enabled: true, url, events: ["MESSAGES_UPSERT"] },
    }),
  });
  if (!r.ok) {
    throw new EvolutionErro(
      `A conexão subiu, mas o recebimento de mensagens não foi configurado (HTTP ${r.status})`,
      502
    );
  }
}

/**
 * Pede o QR para parear.
 *
 * ⚠️ Isto NÃO desconecta nada. Se a instância já estiver conectada, a Evolution
 * costuma devolver o estado em vez do QR — por isso a resposta traz os dois
 * campos e quem chama decide o que mostrar.
 */
export async function qrConexao(
  instancia: string
): Promise<{ qr: string | null; estado: EstadoConexao }> {
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
    const qr = b64
      ? b64.startsWith("data:")
        ? b64
        : `data:image/png;base64,${b64}`
      : null;
    return { qr, estado: traduzirEstado(j.instance?.state ?? "connecting") };
  } catch {
    return { qr: null, estado: "conectando" };
  }
}

export async function desconectar(instancia: string): Promise<void> {
  const r = await chamar(`/instance/logout/${encodeURIComponent(instancia)}`, {
    method: "DELETE",
  });
  // 404 = já não existe. Desconectar o que não está conectado é sucesso.
  if (!r.ok && r.status !== 404) {
    throw new EvolutionErro(
      `Não foi possível desconectar (HTTP ${r.status})`,
      r.status === 401 || r.status === 403 ? 502 : r.status
    );
  }
}

// ── Envio ───────────────────────────────────────────────────────────────────

export async function enviarTexto(
  instancia: string,
  telefone: string,
  texto: string
): Promise<{ id: string | null }> {
  const numero = normalizarTelefone(telefone);
  if (!numero) throw new EvolutionErro("Telefone inválido", 400);

  const r = await chamar(
    `/message/sendText/${encodeURIComponent(instancia)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: numero, text: texto }),
    },
    TIMEOUT_MS
  );

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
