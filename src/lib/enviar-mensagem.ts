// Envio de mensagem pelo CRM — lado do cliente.
//
// Chama a NOSSA rota, nunca o WhatsApp direto. Antes isto era um `fetch` do
// navegador para um webhook do n8n, e isso trouxe três problemas ao mesmo
// tempo: o host caiu e o envio parou sem erro legível; a requisição era
// cross-origin com `Content-Type: application/json`, o que obriga preflight
// OPTIONS; e a URL ficava no bundle, então dava para disparar WhatsApp pela
// clínica sem login. Saindo do servidor, os três somem de uma vez.

export class EnvioErro extends Error {}

export async function enviarMensagem(payload: {
  lead_id: string;
  telefone: string;
  mensagem: string;
}): Promise<{ aviso?: string }> {
  let r: Response;
  try {
    r = await fetch("/api/painel/enviar-mensagem", {
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
  };

  if (!r.ok) {
    // `detalhe` vem da Evolution e diz o que houve de fato (número inválido,
    // instância desconectada, WhatsApp fora do ar) — é o que faltava antes.
    throw new EnvioErro(
      corpo.detalhe || corpo.erro || `Não foi possível enviar (HTTP ${r.status})`
    );
  }

  return { aviso: corpo.aviso };
}
