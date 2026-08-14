// Regras do horário da agenda — PURAS: sem I/O, sem React.
//
// Separado de `slot-agenda.ts` (que chama as RPCs) pelo mesmo motivo de
// `bloqueio-regras.ts`: a decisão do que mostrar num horário precisa poder
// ser testada sem subir ambiente — importar o cliente do Supabase exige as
// variáveis já no carregamento do módulo. O arquivo de I/O importa daqui e
// reexporta, então quem monta a tela continua importando de um lugar só.

import type { AgendamentoComLead } from "@/types/db";

export interface ChecagemSlot {
  ok: boolean;
  codigo: string;
  motivo: string;
  capacidade: number;
  ocupadas: number;
  livres: number;
}

export interface ProfissionalNaEscala {
  profissional_id: string;
  nome: string;
}

/** O instante do slot, como a função espera. `toISOString()` é seguro AQUI —
 *  o que viaja é um instante, não uma chave de dia. (Para chave de dia ele é
 *  proibido neste projeto: converte para UTC e vira o dia à noite.) */
export function instanteDoSlot(dataStr: string, hora: number): string {
  const [a, m, d] = dataStr.split("-").map(Number);
  return new Date(a, m - 1, d, hora, 0, 0, 0).toISOString();
}

/** Clientes marcadas naquela hora — do que a Agenda já carregou, sem ida extra
 *  ao banco. Cancelado fora: ele não ocupa vaga. */
export function marcadasNoSlot(
  agendamentos: AgendamentoComLead[],
  dataStr: string,
  hora: number
): string[] {
  const fora: string[] = [];
  for (const a of agendamentos) {
    if (!a.data_agendamento || a.status === "cancelado") continue;
    const d = new Date(a.data_agendamento);
    const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    if (dia !== dataStr || d.getHours() !== hora) continue;
    fora.push(a.leads?.nome?.trim() || "Cliente sem nome");
  }
  return fora;
}

export type EstadoSlot = "com-vaga" | "sem-vaga" | "fechado";

export function estadoDoSlot(c: ChecagemSlot | null): EstadoSlot {
  if (!c) return "com-vaga"; // ainda carregando: não trava as ações
  if (c.capacidade === 0) return "fechado";
  return c.livres > 0 ? "com-vaga" : "sem-vaga";
}

export interface LinhaProfissional {
  nome: string;
  /** Nome da cliente quando dá para AFIRMAR com quem ela está. */
  com: string | null;
  livre: boolean;
  /** Nem livre nem pareada: sabemos que alguém do horário está ocupada, mas não
   *  quem. */
  indefinido: boolean;
}

/**
 * Cruza escala × agendamentos.
 *
 * ⚠️ `agendamentos.profissional_id` é NULO em 365 de 365 linhas — o vínculo
 * simplesmente não existe no banco hoje. Então "quem está com quem" só é
 * afirmável quando há UMA profissional de plantão: aí não há outra a quem o
 * atendimento possa pertencer.
 *
 * Com duas ou mais, distribuir os nomes seria inventar. Preferimos dizer menos:
 * quem está comprovadamente livre aparece como livre (só quando NINGUÉM está
 * marcado), e o resto fica sem status — as clientes do horário são listadas à
 * parte, sem dono.
 */
export function linhasDoSlot(
  escala: ProfissionalNaEscala[],
  marcadas: string[]
): LinhaProfissional[] {
  return escala.map((p) => {
    if (marcadas.length === 0) {
      return { nome: p.nome, com: null, livre: true, indefinido: false };
    }
    if (escala.length === 1) {
      return {
        nome: p.nome,
        com: marcadas[0],
        livre: false,
        indefinido: false,
      };
    }
    return { nome: p.nome, com: null, livre: false, indefinido: true };
  });
}

/** As clientes que não puderam ser atribuídas a ninguém — vão numa lista à
 *  parte, sem fingir vínculo. Vazio quando o pareamento foi possível. */
export function marcadasSemDono(
  escala: ProfissionalNaEscala[],
  marcadas: string[]
): string[] {
  if (marcadas.length === 0) return [];
  if (escala.length === 1) return marcadas.slice(1);
  return marcadas;
}

/** "2 profissionais na escala · 1 vaga" */
export function resumoSlot(c: ChecagemSlot | null, escala: number): string {
  if (!c) return "";
  if (c.capacidade === 0) return c.motivo;
  const p = `${escala} profissiona${escala === 1 ? "l" : "is"} na escala`;
  const v =
    c.livres === 0
      ? "nenhuma vaga"
      : `${c.livres} vaga${c.livres === 1 ? "" : "s"}`;
  return `${p} · ${v}`;
}
