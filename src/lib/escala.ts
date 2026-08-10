// Conversão entre a GRADE PINTADA (o que a dona vê e clica) e as FAIXAS do
// banco (`profissional_horarios`). Lógica pura — sem I/O, sem React.
//
// A grade tem uma célula por (dia, hora). A célula da hora H representa a
// janela [H:00, H+1:00). Então uma faixa 13:00–20:00 acende as células 13..19
// (a das 19h começa 19h e acaba 20h).
//
// Células CONTÍGUAS viram UMA faixa. Escala alternada (trabalha 8h, folga 9h,
// volta 10h) vira várias faixas no mesmo dia — que é exatamente o que a tabela
// suporta, e por isso o editor é pintável em vez de um formulário.
//
// ⚠️ A grade PRECISA cobrir toda hora que exista no banco. Ela ia até 19h
// enquanto havia turnos 20:00–21:00 gravados (Rozaria, terça e quinta), e o
// editor salva com DELETE + INSERT a partir do que está pintado: abrir a escala
// dela e salvar APAGARIA o turno, sem aviso, porque a hora 20 era descartada na
// leitura. Ao mexer aqui, confira contra o que está em `profissional_horarios`.

export const HORA_GRADE_INICIO = 8;
/** Exclusivo: é o fim da última célula, não o início dela. 21 → última célula
 *  é a das 20h (20:00–21:00), que é o último horário que a clínica atende. */
export const HORA_GRADE_FIM = 21;

/** Horas com célula na grade: 8..20. */
export const HORAS_GRADE: number[] = Array.from(
  { length: HORA_GRADE_FIM - HORA_GRADE_INICIO },
  (_, i) => HORA_GRADE_INICIO + i
);

export const DIAS_GRADE = [
  { dow: 1, label: "Seg" },
  { dow: 2, label: "Ter" },
  { dow: 3, label: "Qua" },
  { dow: 4, label: "Qui" },
  { dow: 5, label: "Sex" },
  { dow: 6, label: "Sáb" },
  { dow: 0, label: "Dom" },
] as const;

export type Faixa = {
  dia_semana: number;
  hora_inicio: string; // "13:00:00"
  hora_fim: string; // "20:00:00"
};

/** Chave de uma célula da grade. */
export function celulaKey(dow: number, hora: number): string {
  return `${dow}-${hora}`;
}

function hhmmss(h: number): string {
  return `${String(h).padStart(2, "0")}:00:00`;
}

/** "13:00:00" → 13. Trunca minutos: a grade é por hora cheia. */
function horaDe(t: string): number {
  return Number(t.split(":")[0]);
}

/**
 * Grade pintada → faixas do banco. Células contíguas no mesmo dia colapsam
 * numa faixa só; um buraco no meio abre uma faixa nova.
 *
 *   células 8,9,10,11 + 13,14  →  08:00–12:00  e  13:00–15:00
 */
export function celulasParaFaixas(celulas: Set<string>): Faixa[] {
  const faixas: Faixa[] = [];

  for (const { dow } of DIAS_GRADE) {
    const horas = HORAS_GRADE.filter((h) => celulas.has(celulaKey(dow, h))).sort(
      (a, b) => a - b
    );
    if (horas.length === 0) continue;

    let ini = horas[0];
    let ant = horas[0];

    for (let i = 1; i <= horas.length; i++) {
      const h = horas[i];
      // Fim do bloco: acabou a lista, ou a próxima hora não é a seguinte.
      if (h === undefined || h !== ant + 1) {
        faixas.push({
          dia_semana: dow,
          hora_inicio: hhmmss(ini),
          hora_fim: hhmmss(ant + 1), // a célula da hora X termina em X+1
        });
        if (h !== undefined) ini = h;
      }
      ant = h;
    }
  }

  return faixas;
}

/**
 * Faixas do banco → grade pintada. Uma faixa 13:00–20:00 acende 13..19.
 *
 * Hora fora da grade é ignorada — e isso é PERDA DE DADO no próximo salvar,
 * porque o editor regrava a partir da grade. Por isso a grade cobre 8..20:
 * qualquer turno que a clínica use precisa caber aqui.
 */
export function faixasParaCelulas(faixas: Faixa[]): Set<string> {
  const celulas = new Set<string>();
  for (const f of faixas) {
    const ini = horaDe(f.hora_inicio);
    const fim = horaDe(f.hora_fim);
    for (let h = ini; h < fim; h++) {
      if (h < HORA_GRADE_INICIO || h >= HORA_GRADE_FIM) continue;
      celulas.add(celulaKey(f.dia_semana, h));
    }
  }
  return celulas;
}

/** "13:00:00" → "13h" · "13:30:00" → "13h30" (rótulos da UI). */
export function rotuloHora(t: string): string {
  const [h, m] = t.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

/** Resumo textual de um dia, para conferência rápida: "8h–12h · 13h–20h". */
export function resumoDia(faixas: Faixa[], dow: number): string {
  const doDia = faixas
    .filter((f) => f.dia_semana === dow)
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  if (doDia.length === 0) return "—";
  return doDia
    .map((f) => `${rotuloHora(f.hora_inicio)}–${rotuloHora(f.hora_fim)}`)
    .join(" · ");
}
