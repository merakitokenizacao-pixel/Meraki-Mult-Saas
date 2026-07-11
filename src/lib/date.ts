// Helpers de período/filtro por data — portados 1:1 do legacy.

export type Periodo = "hoje" | "ontem" | "semana" | "mes" | "tudo";

export interface DateRange {
  from: Date;
  to: Date;
}

// Intervalo [from, to) para o período. "tudo" (ou desconhecido) → null (sem filtro).
export function getDateRange(period: string): DateRange | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "hoje":
      return { from: today, to: new Date(today.getTime() + 86400000) };
    case "ontem": {
      const y = new Date(today.getTime() - 86400000);
      return { from: y, to: today };
    }
    case "semana": {
      const day = today.getDay();
      return {
        from: new Date(today.getTime() - day * 86400000),
        to: new Date(today.getTime() + (7 - day) * 86400000),
      };
    }
    case "mes":
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      };
    default:
      return null;
  }
}

// Uma data (ISO) cai no período? "tudo"/desconhecido → sempre true.
// Normaliza para meio-dia local (como o legacy), usando a parte de data do ISO.
export function matchesPeriod(
  value: string | null | undefined,
  period: string
): boolean {
  const range = getDateRange(period);
  if (!range) return true;
  if (!value) return false;
  const d = new Date(value.toString().split("T")[0] + "T12:00:00");
  return d >= range.from && d < range.to;
}

// "24/07, 17h" (ou "24/07, 17h30" quando há minutos), no fuso da clínica.
// Usado na coluna "Próxima visita" e no painel Detalhes.
export function formatProximaVisita(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tz = "America/Sao_Paulo";
  const data = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
  }).format(d);
  const hm = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  const [h, m] = hm.split(":");
  const hora = m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
  return `${data}, ${hora}`;
}

// Filtra itens cujo campo de data cai no período (normaliza para meio-dia, como o legacy).
export function filterByDate<T>(
  items: T[],
  field: keyof T,
  period: string
): T[] {
  const range = getDateRange(period);
  if (!range) return items;
  return items.filter((i) => {
    const value = i[field];
    if (!value) return false;
    const d = new Date(value.toString().split("T")[0] + "T12:00:00");
    return d >= range.from && d < range.to;
  });
}
