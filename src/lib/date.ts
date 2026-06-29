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
