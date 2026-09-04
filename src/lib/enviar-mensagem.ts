// Envio de mensagem pelo CRM — lado do cliente.
//
// Chama a NOSSA rota, nunca o WhatsApp direto. Antes isto era um `fetch` do
// navegador para um webhook do n8n, e isso trouxe três problemas ao mesmo
// tempo: o host caiu e o envio parou sem erro legível; a requisição era
// cross-origin com `Content-Type: application/json`, o que obriga preflight
// OPTIONS; e a URL ficava no bundle, então dava para disparar WhatsApp pela
// clínica sem login. Saindo do servidor, os três somem de uma vez.

import { fetchPainel } from "@/lib/api-painel";

export class EnvioErro extends Error {
  /** A mensagem chegou a ser gravada na conversa antes de o envio falhar. */
  gravada = false;
}

export async function enviarMensagem(payload: {
  lead_id: string;
  mensagem: string;
}): Promise<{ aviso?: string; gravada?: boolean }> {
  let r: Response;
  try {
    r = await fetchPainel("/api/painel/responder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Mesma origem, então aqui só cai por rede do usuário — não por CORS.
    throw new EnvioErro("Sem conexão. Verifique a internet e tente de novo.");
  }

  if (r.status === 401) {
    throw new EnvioErro("Sua sessão expirou. Entre de novo para responder.");
  }

  const corpo = (await r.json().catch(() => ({}))) as {
    erro?: string;
    detalhe?: string;
    aviso?: string;
    gravada?: boolean;
  };

  if (!r.ok) {
    // ⚠️ `gravada` viaja junto do erro DE PROPÓSITO: a rota escreve a mensagem
    // antes de tentar enviar, então "falhou" quase sempre significa "está na
    // conversa, mas não saiu". Sem este sinal a tela apagaria a bolha otimista
    // e a pessoa reescreveria um texto que já existe.
    const err = new EnvioErro(
      corpo.detalhe || corpo.erro || `Não foi possível enviar (HTTP ${r.status})`
    );
    err.gravada = corpo.gravada === true;
    throw err;
  }

  return { aviso: corpo.aviso, gravada: corpo.gravada };
}
