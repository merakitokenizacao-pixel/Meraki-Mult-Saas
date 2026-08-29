// Tipos e regras do Kanban da agenda.
//
// ⚠️ AS RPCs NÃO VALIDAM O TENANT. `kanban`, `kanban_mover` e `taxa_no_show`
// são SECURITY DEFINER (ignoram RLS), recebem `p_tenant uuid` cru e estão
// concedidas a `authenticated`. É a mesma armadilha de `agenda_consultar`,
// documentada no CLAUDE.md — só que `kanban_mover` ESCREVE.
//
// Chamá-las do navegador deixaria qualquer conta logada ler e MOVER a agenda
// de qualquer clínica trocando um uuid no console. Por isso elas só são
// chamadas de `/api/painel/kanban`, depois de `resolverTenant()` — que passa
// pelo `tenant_valido()` do banco. A regra de ouro do projeto inteira: o
// navegador informa, o banco confere.

export interface CartaoKanban {
  agendamento_id: string;
  lead_id: string;
  /** Já resolvido pela função: `nome_cliente` do agendamento, ou o nome do
   *  lead, ou o telefone. */
  quem: string;
  /** Nome do titular do WhatsApp, presente só quando é DIFERENTE de `quem` —
   *  alguém marcou para outra pessoa. */
  titular: string | null;
  telefone: string | null;
  servico: string | null;
  profissional: string | null;
  quando: string;
  duracao_min: number | null;
  lembrete_enviado: boolean;
  /** O horário já passou e o cartão continua em Pendente ou Confirmado. */
  atrasado: boolean;
}

export interface ColunaKanban {
  status: string;
  rotulo: string;
  descricao: string | null;
  /** Nome do token CSS, já traduzido para o vocabulário da casa. */
  token: string;
  ordem: number;
  cartoes: CartaoKanban[];
}

export interface TaxaNoShow {
  realizados: number;
  faltas: number;
  cancelamentos: number;
  /** Faltas sobre quem deveria comparecer (realizados + faltas). */
  taxa_falta: number | null;
  taxa_cancelamento: number | null;
}

export interface PainelKanban {
  colunas: ColunaKanban[];
  taxa: TaxaNoShow;
}

/**
 * `kanban_colunas.cor` guarda NOME DE TOKEN, não hex — e no vocabulário do
 * desenho (`--st-erro`), não no da casa (`--mk-st-erro`).
 *
 * Duas razões para traduzir por lista fixa em vez de concatenar prefixo:
 *
 * 1. O valor vem do BANCO e ia terminar dentro de `var(...)` num atributo
 *    `style`. Concatenar aceitaria qualquer coisa que estivesse na coluna.
 * 2. Token inexistente não quebra nada visível — `var(--nao-existe)` resolve
 *    para vazio e a cor simplesmente some. É o tipo de defeito que passa por
 *    build, por teste e por revisão.
 */
const TOKENS: Record<string, string> = {
  "--st-aguardando": "--mk-st-aguardando",
  "--st-atendendo": "--mk-st-atendendo",
  "--st-ia": "--mk-st-ia",
  "--st-agendado": "--mk-st-agendado",
  "--st-resolvido": "--mk-st-resolvido",
  "--st-erro": "--mk-st-erro",
  "--st-arquivado": "--mk-st-arquivado",
};

export function tokenDaColuna(cor: string | null | undefined): string {
  if (!cor) return "--mk-tinta-media";
  // Já no vocabulário da casa: aceita, mas só se for um dos sete.
  if (Object.values(TOKENS).includes(cor)) return cor;
  return TOKENS[cor] ?? "--mk-tinta-media";
}

/** `YYYY-MM-DD` no fuso local — as funções recebem `date`, não timestamp. */
export function comoData(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Horário do cartão: `15h` ou `15h30`. Dia só aparece no agrupamento. */
export function horaCurta(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** É amanhã? (usado para o aviso de lembrete não enviado) */
export function ehAmanha(iso: string, agora: Date = new Date()): boolean {
  const d = new Date(iso);
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const alvo = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return alvo.getTime() - hoje.getTime() === 86400000;
}
