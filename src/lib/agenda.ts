// Helpers da Agenda — portados do legacy.

export const HOUR_START = 8;
export const HOUR_END = 20;
export const CELL_H = 60; // altura de cada célula de hora (px)

export const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MESES_CURTO = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

// Domingo da semana que contém `date` (zera horas).
export function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=dom
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export function getWeekDays(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

// "Novembro de 2025" ou "out – nov 2025" se a semana atravessa meses.
export function monthLabel(weekDays: Date[]): string {
  const startMonth = weekDays[0].getMonth();
  const endMonth = weekDays[6].getMonth();
  const year = weekDays[6].getFullYear();
  if (startMonth === endMonth) return MESES[startMonth] + " de " + year;
  return MESES_CURTO[startMonth] + " – " + MESES_CURTO[endMonth] + " " + year;
}

export const HOURS: number[] = Array.from(
  { length: HOUR_END - HOUR_START + 1 },
  (_, i) => HOUR_START + i
);

export function dateKey(d: Date): string {
  return d.toISOString().split("T")[0];
}
