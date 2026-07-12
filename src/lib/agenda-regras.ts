// Regras de capacidade da clínica — FONTE ÚNICA.
// Quantas profissionais atendem em cada hora, por dia da semana.
// Hora ausente = FECHADO (não é agendável).
//
// Ditadas pela dona (jul/2026):
//   • Segunda de manhã: pós-graduação → NUNCA pode haver marcação.
//   • Ter–Sex de manhã (8h–11h): 1 profissional.
//   • 12h: almoço (fechado).
//   • 13h: 2 profissionais.
//   • 14h–17h: 3 profissionais (a última marcação com 3 começa às 17h, termina 18h).
//   • 18h–19h: 1 profissional (a última começa às 19h e termina às 20h).
//   • Sábado: só de manhã, 1 profissional.
//   • Domingo: fechado.
//
// Capacidade = nº de atendimentos SIMULTÂNEOS naquela hora (uma profissional
// atende uma cliente por vez). Um agendamento ocupa TODAS as horas que ele
// atravessa (`duracao_min`), então um de 90min consome 2 faixas.

export const DURACAO_PADRAO_MIN = 60;

type CapacidadePorHora = Record<number, number>;

const MANHA: CapacidadePorHora = { 8: 1, 9: 1, 10: 1, 11: 1 };
const TARDE: CapacidadePorHora = { 13: 2, 14: 3, 15: 3, 16: 3, 17: 3, 18: 1, 19: 1 };

// 0=DOM 1=SEG 2=TER 3=QUA 4=QUI 5=SEX 6=SAB
const CAPACIDADE: Record<number, CapacidadePorHora> = {
  0: {}, // domingo — fechado
  1: { ...TARDE }, // segunda — manhã bloqueada (pós-graduação)
  2: { ...MANHA, ...TARDE },
  3: { ...MANHA, ...TARDE },
  4: { ...MANHA, ...TARDE },
  5: { ...MANHA, ...TARDE },
  6: { ...MANHA }, // sábado — só manhã
};

/** Profissionais disponíveis nessa hora (0 = fechado). */
export function capacidadeEm(date: Date, hora: number): number {
  return CAPACIDADE[date.getDay()]?.[hora] ?? 0;
}

/** Por que a hora está fechada (null = está aberta). Texto para a equipe.
 *  A ordem importa: o sábado é checado ANTES do almoço, senão o sábado à
 *  tarde viraria dois blocos ("Almoço" às 12h + "Só de manhã" às 13h) em vez
 *  de um só. */
export function motivoFechado(date: Date, hora: number): string | null {
  if (capacidadeEm(date, hora) > 0) return null;
  const dow = date.getDay();
  if (dow === 0) return "Fechado aos domingos";
  if (dow === 6) return "Sábado: só atendemos de manhã";
  if (hora === 12) return "Horário de almoço";
  if (dow === 1 && hora < 12) return "Segunda de manhã: pós-graduação";
  return "Fora do horário de atendimento";
}

/** Rótulo curto p/ escrever DENTRO da célula (o motivo completo fica no tooltip). */
export function rotuloFechado(date: Date, hora: number): string {
  const dow = date.getDay();
  if (dow === 0) return "Fechado";
  if (dow === 6) return "Só de manhã";
  if (hora === 12) return "Almoço";
  if (dow === 1 && hora < 12) return "Pós-graduação";
  return "Fechado";
}

// Shape mínimo que as funções precisam de um agendamento.
export type AgendCapacidade = {
  data_agendamento: string;
  duracao_min?: number | null;
  status?: string | null;
  id?: string;
};

// [início, fim) do agendamento, em ms.
function janela(a: AgendCapacidade): [number, number] {
  const ini = new Date(a.data_agendamento).getTime();
  const dur = Number(a.duracao_min) || DURACAO_PADRAO_MIN;
  return [ini, ini + dur * 60000];
}

// [início, fim) da faixa de 1h.
function faixaHora(date: Date, hora: number): [number, number] {
  const ini = new Date(date);
  ini.setHours(hora, 0, 0, 0);
  return [ini.getTime(), ini.getTime() + 3600000];
}

/**
 * Quantos atendimentos ocupam essa hora. Conta por SOBREPOSIÇÃO (um de 90min
 * que começa 14:30 ocupa a faixa das 14h E a das 15h). Cancelado não ocupa.
 * `ignorarId` serve para recalcular sem contar o próprio agendamento (edição).
 */
export function ocupacaoEm(
  agendamentos: AgendCapacidade[],
  date: Date,
  hora: number,
  ignorarId?: string
): number {
  const [fIni, fFim] = faixaHora(date, hora);
  let n = 0;
  for (const a of agendamentos) {
    if (!a.data_agendamento) continue;
    if (a.status === "cancelado") continue;
    if (ignorarId && a.id === ignorarId) continue;
    const [ini, fim] = janela(a);
    if (ini < fFim && fim > fIni) n++; // sobrepõe
  }
  return n;
}

export type Vagas = {
  capacidade: number;
  ocupadas: number;
  livres: number;
  fechado: boolean;
  lotado: boolean;
  motivo: string | null; // preenchido quando fechado
};

export function vagasEm(
  agendamentos: AgendCapacidade[],
  date: Date,
  hora: number,
  ignorarId?: string
): Vagas {
  const capacidade = capacidadeEm(date, hora);
  if (capacidade === 0) {
    return {
      capacidade: 0,
      ocupadas: ocupacaoEm(agendamentos, date, hora, ignorarId),
      livres: 0,
      fechado: true,
      lotado: false,
      motivo: motivoFechado(date, hora),
    };
  }
  const ocupadas = ocupacaoEm(agendamentos, date, hora, ignorarId);
  const livres = Math.max(0, capacidade - ocupadas);
  return {
    capacidade,
    ocupadas,
    livres,
    fechado: false,
    lotado: livres === 0,
    motivo: null,
  };
}

/**
 * Pode marcar? Checa TODAS as faixas de hora que o novo agendamento atravessa:
 * nenhuma pode estar fechada, e em nenhuma a ocupação pode estourar a
 * capacidade. É esta função que impede overbooking na hora de salvar.
 */
export function podeAgendar(
  agendamentos: AgendCapacidade[],
  dataStr: string, // "2026-07-24"
  horaStr: string, // "14:30"
  duracaoMin: number = DURACAO_PADRAO_MIN,
  ignorarId?: string
): { ok: boolean; motivo?: string } {
  if (!dataStr || !horaStr) return { ok: false, motivo: "Informe data e horário." };

  const inicio = new Date(`${dataStr}T${horaStr}:00`);
  if (Number.isNaN(inicio.getTime()))
    return { ok: false, motivo: "Data ou horário inválido." };

  const fim = new Date(inicio.getTime() + duracaoMin * 60000);

  // Faixas de hora tocadas: da hora de início até a última hora antes do fim.
  const primeira = inicio.getHours();
  const ultimaMs = fim.getTime() - 1; // fim é exclusivo
  const ultima = new Date(ultimaMs).getHours();

  for (let h = primeira; h <= ultima; h++) {
    const v = vagasEm(agendamentos, inicio, h, ignorarId);
    if (v.fechado) {
      return {
        ok: false,
        motivo:
          h === primeira
            ? (v.motivo ?? "Horário fechado.")
            : `O atendimento invadiria as ${String(h).padStart(2, "0")}h — ${(
                v.motivo ?? "horário fechado"
              ).toLowerCase()}.`,
      };
    }
    if (v.livres <= 0) {
      const hh = String(h).padStart(2, "0");
      return {
        ok: false,
        motivo:
          v.capacidade === 1
            ? `Sem vaga às ${hh}h: a única profissional do horário já está ocupada.`
            : `Sem vaga às ${hh}h: as ${v.capacidade} profissionais já estão ocupadas.`,
      };
    }
  }
  return { ok: true };
}
