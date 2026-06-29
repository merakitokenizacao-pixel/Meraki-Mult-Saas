// Webhook do n8n para envio de mensagem pelo CRM (mesmo do legacy).
// Pode ser sobrescrito por env; o agente Laura vive fora deste repo (n8n).
const WEBHOOK_ENVIAR_MSG =
  process.env.NEXT_PUBLIC_N8N_WEBHOOK_ENVIAR_MSG ||
  "https://n8n-n8n.2ghreo.easypanel.host/webhook/enviar-msg-crm";

export async function enviarMensagemWebhook(payload: {
  lead_id: string;
  telefone: string;
  mensagem: string;
}): Promise<void> {
  const response = await fetch(WEBHOOK_ENVIAR_MSG, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  await response.json().catch(() => ({}));
}
