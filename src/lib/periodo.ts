// Intervalo de datas escolhido à mão — a parte PURA (sem I/O, sem React).
//
// A decisão que sustenta tudo aqui: o intervalo customizado viaja dentro da
// MESMA string `period` que já circula pelo sistema, no formato
// `custom:2026-07-03..2026-07-17`.
//
// A alternativa seria trocar `period: string` por um objeto em todo lugar —
// `getDateRange`, `filterByDate`, `matchesPeriod`, `serieDiaria`,
// `rotuloIntervalo`, `resumoFinanceiro`, `rankingServicos`, as telas. Como
// todos eles já perguntam o intervalo a `getDateRange`, ensinar UMA função a
// ler o prefixo faz o resto funcionar sem tocar em nada.

/** Data local em `YYYY-MM-DD`.
 *
 * Nunca `toISOString()`: ele converte para UTC, e às 21h de Brasília o dia 11
 * vira 12. Todo este arquivo trabalha em horário local, que é o fuso da
 * clínica. */
export function chaveDia(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

/** `YYYY-MM-DD` → Date local à meia-noite. */
export function deChaveDia(s: string): Date {
  const [a, m, d] = s.split("-").map(Number);
  return new Date(a, m - 1, d);
}

export const PREFIXO_CUSTOM = "custom:";

/** Monta o valor de `period` para um intervalo escolhido à mão. Ordena as
 *  pontas: clicar 17 e depois 3 é a mesma seleção que 3 e depois 17. */
export function periodoCustom(a: Date, b: Date): string {
  const [ini, fim] = a.getTime() <= b.getTime() ? [a, b] : [b, a];
  return `${PREFIXO_CUSTOM}${chaveDia(ini)}..${chaveDia(fim)}`;
}

/** Lê o intervalo de volta. Devolve null quando não é custom ou está torto —
 *  string inválida vira "sem filtro", nunca uma exceção no meio do render. */
export function lerPeriodoCustom(
  period: string
): { de: Date; ate: Date } | null {
  if (!period?.startsWith(PREFIXO_CUSTOM)) return null;
  const [a, b] = period.slice(PREFIXO_CUSTOM.length).split("..");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(b ?? ""))
    return null;
  const de = deChaveDia(a);
  const ate = deChaveDia(b);
  if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime())) return null;
  return de.getTime() <= ate.getTime() ? { de, ate } : { de: ate, ate: de };
}

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Iniciais dos dias, começando no DOMINGO — a mesma convenção do
 *  `getDateRange("semana")` e a que a clínica usa na agenda. */
export const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export interface CelulaDia {
  data: Date;
  chave: string;
  /** Dia de preenchimento, de outro mês: pintado mais fraco. Continua
   *  clicável — quem quer 30/07 a 02/08 não deveria trocar de mês no meio. */
  foraDoMes: boolean;
}

/**
 * As 6 semanas × 7 dias da grade de um mês.
 *
 * Sempre 42 células, mesmo quando o mês cabe em 5 semanas: com altura variável
 * o popover cresce e encolhe ao navegar entre meses, e o rodapé pula debaixo
 * do cursor.
 */
export function gradeDoMes(ano: number, mes: number): CelulaDia[] {
  const primeiro = new Date(ano, mes, 1);
  const inicio = new Date(ano, mes, 1 - primeiro.getDay());
  const celulas: CelulaDia[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    celulas.push({
      data: d,
      chave: chaveDia(d),
      foraDoMes: d.getMonth() !== mes,
    });
  }
  return celulas;
}

/** Soma meses sem estourar o dia: `addMes(31/01, 1)` daria 03/03 se somasse
 *  direto no mês, porque fevereiro não tem 31. Ancorar no dia 1 evita isso —
 *  a navegação do calendário só precisa do par ano/mês. */
export function addMes(ano: number, mes: number, n: number): { ano: number; mes: number } {
  const d = new Date(ano, mes + n, 1);
  return { ano: d.getFullYear(), mes: d.getMonth() };
}

export type PosicaoNoRange = "fora" | "extremidade" | "dentro";

/**
 * Onde o dia cai no intervalo.
 *
 * É isto que permite pintar as pontas com a cor da marca e o MIOLO em neutro.
 * Preencher o intervalo inteiro com um tom do accent — o padrão de quase todo
 * kit — transforma 8 dias num borrão colorido; com só as duas pontas coloridas
 * a cor passa a dizer "começa aqui, termina aqui".
 */
export function posicaoNoRange(
  dia: Date,
  de: Date | null,
  ate: Date | null
): PosicaoNoRange {
  if (!de) return "fora";
  const t = dia.getTime();
  const a = de.getTime();
  // Seleção pela metade (só o primeiro clique): a única ponta é extremidade.
  if (!ate) return t === a ? "extremidade" : "fora";
  const b = ate.getTime();
  if (t === a || t === b) return "extremidade";
  return t > a && t < b ? "dentro" : "fora";
}

/** Anos oferecidos no seletor. Uma janela em volta do ano corrente e do que
 *  está sendo mostrado — sem isso, abrir um intervalo de 2024 deixaria o
 *  próprio ano de fora da lista. */
export function anosDisponiveis(anoAtual: number, anoVisivel: number): number[] {
  const min = Math.min(anoAtual - 4, anoVisivel);
  const max = Math.max(anoAtual + 1, anoVisivel);
  const fora: number[] = [];
  for (let a = min; a <= max; a++) fora.push(a);
  return fora;
}
