// Helpers puros das Conversas — portados 1:1 do legacy.
import { fmtDate } from "@/lib/format";
import { textoLimpo } from "@/lib/formato-whatsapp";
import { textoReal } from "@/lib/midia";
import type { Agendamento, Conversa, Lead } from "@/types/db";

export function isLeadPaused(lead: Lead | null | undefined): boolean {
  return !!lead && lead.ia_pausada === true;
}

// Inativo = sem interação há mais de 30 dias (usa última interação; cai pro cadastro).
export function isLeadInativo(lead: Lead): boolean {
  const ref = lead.ultima_interacao || lead.criado_em;
  if (!ref) return false;
  const diff = (Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24);
  return diff > 30;
}

// getTemp saiu: lia `leads.score_ia` e `leads.temperatura`, removidas do banco
// em ago/2026. Sem fonte, o selo de temperatura no chat ficava sempre vazio.

// LTV real. Passou a valer de verdade em ago/2026: `agendamentos.valor` agora é
// preenchido pelo trigger de precificação, então isto deixou de somar zeros.
// Soma dos valores de atendimentos realizados (não cancelados).
export function getLTV(leadId: string, agendamentos: Agendamento[]): number {
  return agendamentos
    .filter(
      (a) => a.lead_id === leadId && a.status !== "cancelado" && a.valor != null
    )
    .reduce((acc, a) => acc + (Number(a.valor) || 0), 0);
}

export function getIASummary(lead: Lead): string | null {
  const r = (lead.resumo_ia || "").trim();
  return r || null;
}

// getTags saiu junto: `leads.tags` também foi removida.

// Ícone do canal (glifo unicode + título).
export function getChannelIcon(lead: Lead): { glyph: string; title: string } {
  const c = (lead.canal || "whatsapp").toLowerCase();
  if (c.includes("insta")) return { glyph: "☯", title: "Instagram" };
  if (c.includes("site") || c.includes("web"))
    return { glyph: "⚭", title: "Site" };
  return { glyph: "✉", title: "WhatsApp" };
}

// Prévia da última mensagem do cache, com prefixo 🤖 (agente) / 👤 (humano).
export function getLastMsgPreview(
  lead: Lead,
  conversas: Conversa[]
): { text: string; fromAgente: boolean } {
  const convs = conversas
    .filter((c) => c.lead_id === lead.id)
    .sort(
      (a, b) => new Date(b.enviado_em).getTime() - new Date(a.enviado_em).getTime()
    );
  if (!convs.length) return { text: "Sem mensagens ainda", fromAgente: false };
  const last = convs[0];
  let prefix = "";
  if (last.origem === "agente") prefix = "🤖 ";
  else if (last.origem === "humano") prefix = "👤 ";
  // Mídia: o `mensagem` guarda um placeholder do n8n (`[o cliente mandou uma
  // foto]`), e mostrar isso cru no card é vazar a mecânica interna. O áudio é
  // diferente — ali o campo é a TRANSCRIÇÃO, que é justamente o que ajuda a
  // decidir se vale abrir a conversa, então ela fica.
  if (last.media_path) {
    const legenda = textoReal(last.mensagem);
    const rotulo =
      last.media_tipo === "audio"
        ? `🎤 ${legenda ?? "Áudio"}`
        : `📷 ${legenda ?? "Foto"}`;
    return {
      text: prefix + textoLimpo(rotulo).substring(0, 60),
      fromAgente: last.origem === "agente",
    };
  }
  // Tira a marcação do WhatsApp: no card não há como estilizar, então o
  // `*negrito*` da Laura apareceria com os asteriscos crus no preview.
  // Limpa ANTES de cortar em 60 — cortar primeiro poderia deixar um `*` órfão.
  return {
    text: prefix + textoLimpo(last.mensagem || "").substring(0, 60),
    fromAgente: last.origem === "agente",
  };
}

// Última mensagem do lead (ts para ordenar; raw para o tempo relativo no card).
export function lastMsgInfo(
  lead: Lead,
  conversas: Conversa[]
): { ts: number; raw: string | null } {
  let ts = 0;
  let raw: string | null = null;
  for (const c of conversas) {
    if (c.lead_id !== lead.id) continue;
    const t = new Date(c.enviado_em).getTime();
    if (t > ts) {
      ts = t;
      raw = c.enviado_em;
    }
  }
  if (ts) return { ts, raw };
  const fallback = lead.ultima_interacao || lead.criado_em || null;
  return { ts: fallback ? new Date(fallback).getTime() : 0, raw: fallback };
}

// Rótulo do separador de dia: HOJE / ONTEM / "12 mar 2025".
export function formatDayLabel(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compare = new Date(d);
  compare.setHours(0, 0, 0, 0);
  const diffD = (today.getTime() - compare.getTime()) / (1000 * 60 * 60 * 24);
  if (diffD === 0) return "HOJE";
  if (diffD === 1) return "ONTEM";
  return d
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

// Re-export usado pelos cards do inbox.
export { fmtDate };
