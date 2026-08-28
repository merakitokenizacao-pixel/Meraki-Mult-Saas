import { isLeadInativo, isLeadPaused } from "@/lib/conversa";
import type { Agendamento, Lead } from "@/types/db";

// Em que ponto da fila cada conversa está.
//
// ⚠️ TUDO AQUI SAI DE COLUNA QUE EXISTE. O desenho pedia sete estados; o banco
// sustenta cinco. O que ficou de fora, e por quê:
//
//   resolvido  — não existe. `leads.status` é texto livre (sem CHECK) e o ciclo
//                de vida gravado é novo/cliente/inativo. Não há "fechou bem".
//   erro       — não existe. `motivo_pausa` é texto livre; hoje só o painel
//                escreve nele, com duas frases fixas. Ler erro dali seria
//                inventar enum em cima de texto livre.
//   arquivado  — não existe como AÇÃO. O que existe é `inativo`, derivado de
//                `ultima_interacao` (+30 dias) e já em uso na tela. É o mesmo
//                "saiu da fila", só que ninguém arquivou — o tempo arquivou.
//                Por isso o chip se chama Inativo e não Arquivado: dizer
//                "arquivado" prometeria um botão que não existe.
//
// Os tokens dos três continuam definidos (a Agenda e os KPIs usam `resolvido`
// e `erro`); o que não existe é o CHIP.
export type EstadoConversa =
  | "aguardando"
  | "atendendo"
  | "agendado"
  | "ia"
  | "inativo";

/** Status de `agendamentos` que ainda vão acontecer (CHECK do banco: pendente,
 *  confirmado, realizado, faltou, cancelado). */
const AINDA_VAI_ACONTECER = new Set(["pendente", "confirmado"]);

/** Quem tem horário marcado ainda por acontecer. Set, e não um `some()` por
 *  lead: com 500 conversas e 400 agendamentos aquilo é 200 mil comparações a
 *  cada render, e a resposta é sempre a mesma. */
function comHorarioMarcado(agendamentos: Agendamento[]): Set<string> {
  const agora = Date.now();
  const s = new Set<string>();
  for (const a of agendamentos) {
    if (!AINDA_VAI_ACONTECER.has(a.status)) continue;
    if (new Date(a.data_agendamento).getTime() < agora) continue;
    s.add(a.lead_id);
  }
  return s;
}

/**
 * A ordem é PRIORIDADE, não gosto — os cinco formam uma partição, cada conversa
 * cai em exatamente um chip, e a soma das contagens fecha com o total.
 *
 * 1. inativo    — 30 dias sem interação. Vem primeiro porque um lead parado há
 *                 40 dias não está "aguardando" ninguém.
 * 2. aguardando — a IA está pausada E há mensagem não lida. Alguém tirou a IA
 *                 da conversa e ainda não respondeu: é o "precisa de mim
 *                 agora". `nao_lidas` zera quando o painel ABRE a conversa —
 *                 abrir conta como pegar, que é a semântica do contador.
 * 3. atendendo  — a IA está pausada e não há nada por ler: humano dentro da
 *                 conversa, em dia.
 * 4. agendado   — a IA conduz e já existe horário marcado no futuro. Mais
 *                 específico que "ia", e é o que a dona quer contar.
 * 5. ia         — o resto: a IA está conduzindo.
 */
function classificar(lead: Lead, marcados: Set<string>): EstadoConversa {
  if (isLeadInativo(lead)) return "inativo";
  if (isLeadPaused(lead)) {
    return (Number(lead.nao_lidas) || 0) > 0 ? "aguardando" : "atendendo";
  }
  if (marcados.has(lead.id)) return "agendado";
  return "ia";
}

/** O estado de uma conversa só. */
export function estadoDaConversa(
  lead: Lead,
  agendamentos: Agendamento[]
): EstadoConversa {
  return classificar(lead, comHorarioMarcado(agendamentos));
}

/** O estado de todas de uma vez — é o que a tela usa, para a varredura dos
 *  agendamentos acontecer uma vez e não uma por conversa. */
export function classificarConversas(
  leads: Lead[],
  agendamentos: Agendamento[]
): Map<string, EstadoConversa> {
  const marcados = comHorarioMarcado(agendamentos);
  const m = new Map<string, EstadoConversa>();
  for (const l of leads) m.set(l.id, classificar(l, marcados));
  return m;
}
