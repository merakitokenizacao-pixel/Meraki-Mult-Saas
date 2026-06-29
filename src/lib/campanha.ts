// Helpers de Campanhas — portados 1:1 do legacy.
import type { LeadParaCampanha } from "@/lib/queries";

export const PUBLICO_LABELS: Record<string, string> = {
  todos: "Todos os clientes",
  inativos_30: "Inativos +30d",
  inativos_60: "Inativos +60d",
};

export function publicoLabel(p: string | null): string {
  return (p && PUBLICO_LABELS[p]) || p || "";
}

const BADGE_MAP: Record<string, [string, string]> = {
  rascunho: ["badge-rascunho", "Rascunho"],
  enviando: ["badge-enviando", "Enviando"],
  concluida: ["badge-concluida", "Concluída"],
  pausada: ["badge-pausada", "Pausada"],
};

export function campBadge(status: string | null): { cls: string; label: string } {
  const [cls, label] = BADGE_MAP[status ?? ""] || BADGE_MAP.rascunho;
  return { cls, label };
}

// Leads elegíveis: respeita opt-out, exige telefone, aplica o público.
export function filtrarPublico(
  leads: LeadParaCampanha[],
  publico: string
): LeadParaCampanha[] {
  const aptos = leads.filter((l) => l.aceita_campanha !== false && l.telefone);
  if (publico === "todos") return aptos;
  const dias = publico === "inativos_60" ? 60 : 30;
  const limite = Date.now() - dias * 86400000;
  return aptos.filter((l) => {
    const ref = l.ultima_interacao || l.criado_em;
    return ref ? new Date(ref).getTime() < limite : false;
  });
}
