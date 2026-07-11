// Fonte ÚNICA do mapeamento de exibição do ciclo de vida do lead.
// `leads.status` agora representa só a relação (não "tem horário marcado" —
// isso é derivado de `agendamentos`). Valores legados (agendado, convertido,
// perdido, em_atendimento) continuam no banco e são apenas mapeados aqui.
// Ver CLAUDE.md, "Status de ciclo de vida".

export type LeadStatusVariant = "novo" | "cliente" | "inativo";

// raw (leads.status) → { label exibido, variante visual }.
const MAP: Record<string, { label: string; variant: LeadStatusVariant }> = {
  // nunca foi atendido (inclui estados operacionais legados)
  novo: { label: "NOVO", variant: "novo" },
  em_atendimento: { label: "NOVO", variant: "novo" },
  agendado: { label: "NOVO", variant: "novo" },
  // já virou cliente de verdade (tom de conquista)
  cliente: { label: "CLIENTE", variant: "cliente" },
  convertido: { label: "CLIENTE", variant: "cliente" },
  // sumido / perdido
  inativo: { label: "INATIVO", variant: "inativo" },
  perdido: { label: "INATIVO", variant: "inativo" },
};

export function leadStatusDisplay(raw: string | null | undefined): {
  label: string;
  variant: LeadStatusVariant;
} {
  const key = (raw ?? "").toString().trim().toLowerCase();
  return MAP[key] ?? { label: "NOVO", variant: "novo" };
}

// Opções do filtro de status (mesmo mapeamento): "Novo" pega novo/agendado/
// em_atendimento; "Cliente" pega cliente/convertido; "Inativo" pega inativo/
// perdido. "todos" não filtra.
export const STATUS_FILTER_OPTIONS: ReadonlyArray<[string, string]> = [
  ["todos", "Todos"],
  ["novo", "Novo"],
  ["cliente", "Cliente"],
  ["inativo", "Inativo"],
];

export function matchesStatusFilter(
  raw: string | null | undefined,
  filter: string
): boolean {
  if (!filter || filter === "todos") return true;
  return leadStatusDisplay(raw).variant === filter;
}
