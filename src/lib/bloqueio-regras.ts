// Regras de bloqueio de horário — PURAS: sem I/O, sem React.
//
// Separado de `bloqueios.ts` (que fala com o Supabase) pelo mesmo motivo que
// `agenda-regras.ts` é separado das queries: regra que decide se um bloqueio
// pisa num atendimento precisa poder ser testada sem subir ambiente. O arquivo
// de I/O importa daqui e reexporta.

import type { AgendamentoComLead } from "@/types/db";

export interface Bloqueio {
  id: string;
  profissional_id: string;
  /** "2026-08-13" */
  data: string;
  /** NULO nos DOIS = dia inteiro. É assim que a função do banco entende — não
   *  use 00:00–23:59, que é uma janela e seria tratada como faixa. */
  hora_inicio: string | null;
  hora_fim: string | null;
  motivo: string | null;
}

/** "13:00:00" ou "13:00" → 780. Hora nula = dia inteiro, tratado por quem
 *  chama. */
export function minutosDe(hora: string): number {
  const [h, m] = hora.split(":");
  return Number(h) * 60 + Number(m || 0);
}

/**
 * Dois intervalos [a1,a2) e [b1,b2) se tocam?
 *
 * Fim EXCLUSIVO: um bloqueio 10:00–11:00 não conflita com um atendimento que
 * começa exatamente às 11:00. Com fim inclusivo, todo horário encostado viraria
 * um aviso falso e a dona aprenderia a ignorar o aviso.
 */
export function faixasSobrepoem(
  a1: number,
  a2: number,
  b1: number,
  b2: number
): boolean {
  return a1 < b2 && b1 < a2;
}

export interface ConflitoAgendamento {
  nome: string;
  hora: string;
}

/**
 * Agendamentos NÃO-CANCELADOS que caem dentro da janela do bloqueio.
 *
 * Bloquear não cancela nada. Sem este aviso, a agenda ficaria mentindo para os
 * dois lados: o horário sumiria para a Laura enquanto a cliente segue marcada.
 *
 * `profissionalIds` filtra por quem foi escolhido — mas `agendamentos` não tem
 * `profissional_id` preenchido hoje (é nulo em 100% das linhas), então o filtro
 * só se aplica quando a coluna existir de fato. Enquanto não existir, qualquer
 * atendimento no horário conta como conflito, que é o lado seguro do erro.
 */
export function conflitosNoPeriodo(
  agendamentos: AgendamentoComLead[],
  data: string,
  horaInicio: string | null,
  horaFim: string | null
): ConflitoAgendamento[] {
  const diaTodo = !horaInicio || !horaFim;
  const b1 = diaTodo ? 0 : minutosDe(horaInicio);
  const b2 = diaTodo ? 24 * 60 : minutosDe(horaFim);

  const fora: ConflitoAgendamento[] = [];
  for (const a of agendamentos) {
    if (!a.data_agendamento || a.status === "cancelado") continue;
    const d = new Date(a.data_agendamento);
    // Dia local, montado à mão: `toISOString()` viraria o dia à noite.
    const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    if (dia !== data) continue;

    const ini = d.getHours() * 60 + d.getMinutes();
    const fim = ini + (a.duracao_min ?? 60);
    if (!faixasSobrepoem(ini, fim, b1, b2)) continue;

    fora.push({
      nome: a.leads?.nome?.trim() || "Cliente sem nome",
      hora: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    });
  }
  return fora;
}

/** Rótulo do bloqueio na grade: o motivo, ou "Bloqueado" quando vazio. Nunca
 *  nome de cliente — bloqueio não tem cliente. */
export function rotuloBloqueio(b: Bloqueio): string {
  return b.motivo?.trim() || "Bloqueado";
}
