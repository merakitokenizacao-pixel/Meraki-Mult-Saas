// Helpers de período/filtro por data — portados 1:1 do legacy.

export type Periodo = "hoje" | "ontem" | "semana" | "mes" | "tudo";

export interface DateRange {
  from: Date;
  to: Date;
}

// Intervalo [from, to) para o período. "tudo" (ou desconhecido) → null (sem filtro).
//
// `agora` é injetável só para teste: sem isso, tudo que depende de período fica
// amarrado ao relógio da máquina e não dá para verificar com data fixa — que é
// exatamente onde moram os bugs de data (virada de mês, madrugada, fuso).
// Nenhum chamador de produção passa o argumento.
export function getDateRange(
  period: string,
  agora: Date = new Date()
): DateRange | null {
  const now = agora;
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

const MESES_CURTO = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/**
 * O intervalo do período por extenso: "26 jul – 1 ago, 2026".
 *
 * Mostrar a DATA (e não só "Semana") tira a ambiguidade de qual janela está no
 * ar — principalmente na semana, que aqui começa no domingo e nem todo mundo
 * conta assim.
 *
 * `getDateRange` devolve `to` EXCLUSIVO, então o último dia é `to - 1ms`; usar
 * `to` direto mostraria um dia a mais.
 */
export function rotuloIntervalo(period: string): string {
  const r = getDateRange(period);
  if (!r) return "Todo o período";

  const fim = new Date(r.to.getTime() - 1);
  const dm = (d: Date) => `${d.getDate()} ${MESES_CURTO[d.getMonth()]}`;

  // Hoje/Ontem são um dia só: "27 jul, 2026" em vez de repetir a data.
  if (r.from.toDateString() === fim.toDateString()) {
    return `${dm(r.from)}, ${fim.getFullYear()}`;
  }
  return `${dm(r.from)} – ${dm(fim)}, ${fim.getFullYear()}`;
}

/**
 * Saudação pelo horário de quem está lendo.
 *
 * Usa o relógio do NAVEGADOR de propósito (não America/Sao_Paulo como o resto
 * do projeto): cumprimentar é sobre a pessoa, não sobre a clínica — se ela
 * abrir o painel às 22h de onde estiver, "boa noite" é o certo mesmo que em
 * Brasília ainda seja tarde.
 *
 * A madrugada (0h–4h) é "boa noite", não "bom dia": às 3h da manhã ninguém
 * cumprimenta com bom dia.
 */
export function saudacaoDe(agora: Date = new Date()): {
  prefix: string;
  word: string;
} {
  const h = agora.getHours();
  if (h >= 5 && h < 12) return { prefix: "Bom", word: "dia" };
  if (h >= 12 && h < 18) return { prefix: "Boa", word: "tarde" };
  return { prefix: "Boa", word: "noite" }; // 18h–4h59
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
