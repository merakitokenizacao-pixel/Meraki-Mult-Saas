// Camada financeira da aba Negócios — lógica pura, sem I/O, testável.
//
// ⚠️ O QUE É REAL E O QUE NÃO É
//
// REAL: quais agendamentos existem, quando, com que status e de que serviço.
// Tudo sai da tabela `agendamentos`.
//
// ESTIMADO: o VALOR. A coluna `agendamentos.valor` está 100% vazia (o n8n não
// preenche), então o preço vem da tabela abaixo — ancorada nos valores reais
// que a clínica pratica, lidos da tabela `promocoes`.
//
// SINTÉTICO: a atribuição por PROFISSIONAL. As colunas `profissional_id` e
// `profissional` estão 100% nulas nos 251 agendamentos, ou seja, não existe
// vínculo no banco. A distribuição aqui é derivada do id por hash — estável
// entre renders, plausível na forma, e sem nenhum valor de verdade.
//
// Quando as tabelas definitivas existirem, só `valorDe` e `profissionalDe`
// mudam; todo o resto do arquivo e os componentes seguem iguais.

import type { Agendamento } from "@/types/db";
import { getDateRange } from "@/lib/date";

/** Liga/desliga os dados estimados de uma vez. Ver aviso na tela. */
export const FINANCEIRO_ESTIMADO = true;

// ── Preços ───────────────────────────────────────────────────────────────────
// Casados por trecho, do mais específico para o mais genérico — "Pacote 10
// sessões de drenagem" precisa bater ANTES de "drenagem".
const PRECOS: ReadonlyArray<readonly [string, number]> = [
  ["agosto da modelagem", 850],
  ["pacote copa de massagem", 499.9],
  ["pacote 10 sessões", 499.9],
  ["pacote 10 sessoes", 499.9],
  ["drenagem linfática convencional (pacote)", 499.9],
  ["combo laser day", 180],
  ["depilação a laser", 180],
  ["depilacao a laser", 180],
  ["microagulhamento", 450],
  ["botox", 890],
  ["peeling", 180],
  ["limpeza de pele", 150],
  ["massagem desportiva", 140],
  ["massagem relaxante", 120],
  ["drenagem linfática", 120],
  ["drenagem linfatica", 120],
  ["depilação com cera", 60],
  ["depilação de virilha", 70],
  ["depilação de axila", 45],
  ["avaliação corporal", 0],
];

/** Ticket usado quando o serviço não está na tabela (legado, "Outro"…). */
const PRECO_PADRAO = 100;

export function precoDoServico(servico?: string | null): number {
  if (!servico) return PRECO_PADRAO;
  const s = servico.toLowerCase();
  for (const [trecho, preco] of PRECOS) if (s.includes(trecho)) return preco;
  return PRECO_PADRAO;
}

/** Valor de um agendamento: o do banco quando existir, senão o estimado. */
export function valorDe(a: Agendamento): number {
  if (typeof a.valor === "number" && a.valor > 0) return a.valor;
  return precoDoServico(a.servico);
}

// ── Profissionais ────────────────────────────────────────────────────────────
// A cor é um TOKEN, não um hex. A tabela `profissionais` guarda hex da paleta
// CLARA (#3a6b4f, #2a5278…), que sobre superfície escura fica ilegível — medido
// em 2:1 no tema Escuro. Apontando para o token, cada tema entrega a sua versão
// da mesma cor e os três funcionam sem uma regra a mais.
export const PROFISSIONAIS: ReadonlyArray<{
  nome: string;
  token: string;
  peso: number;
}> = [
  { nome: "Mônica", token: "--vx-accent", peso: 4 },
  { nome: "Alana", token: "--vx-green", peso: 3 },
  { nome: "Gabriela", token: "--vx-blue", peso: 2 },
  { nome: "Rozaria", token: "--vx-red", peso: 1 },
];

/** Hash estável do id. Determinístico de propósito: `Math.random()` mudaria a
 *  cada render e quebraria a hidratação (servidor e cliente sortear diferente). */
function hashEstavel(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const PESO_TOTAL = PROFISSIONAIS.reduce((s, p) => s + p.peso, 0);

export function profissionalDe(a: Agendamento): (typeof PROFISSIONAIS)[number] {
  let n = hashEstavel(a.id) % PESO_TOTAL;
  for (const p of PROFISSIONAIS) {
    if (n < p.peso) return p;
    n -= p.peso;
  }
  return PROFISSIONAIS[0];
}

// ── Recortes de período ──────────────────────────────────────────────────────
function dentroDoPeriodo(
  iso: string | null,
  period: string,
  agora?: Date
): boolean {
  if (!iso) return false;
  const r = getDateRange(period, agora);
  if (!r) return true; // "tudo"
  const t = new Date(iso).getTime();
  return t >= r.from.getTime() && t < r.to.getTime();
}

export interface Faixa {
  valor: number;
  qtd: number;
}
export interface ResumoFinanceiro {
  criado: Faixa;
  ganho: Faixa;
  perdido: Faixa;
  aberto: Faixa;
  recuperado: Faixa;
}

const zero = (): Faixa => ({ valor: 0, qtd: 0 });
function somar(f: Faixa, a: Agendamento): void {
  f.valor += valorDe(a);
  f.qtd += 1;
}

/**
 * Cada card usa a data que faz sentido para ele:
 *  · criado   → `criado_em` (quando entrou no funil)
 *  · ganho    → `data_agendamento` (quando o atendimento aconteceu)
 *  · perdido  → `data_agendamento` (quando teria acontecido)
 *  · aberto   → NÃO usa período: é situação de AGORA. Filtrar por período faria
 *               a caixa "Ontem" mostrar zero em aberto, o que não diz nada.
 */
export function resumoFinanceiro(
  agendamentos: Agendamento[],
  period: string,
  agoraRef: Date = new Date()
): ResumoFinanceiro {
  const r: ResumoFinanceiro = {
    criado: zero(),
    ganho: zero(),
    perdido: zero(),
    aberto: zero(),
    recuperado: zero(),
  };
  const agora = agoraRef.getTime();

  for (const a of agendamentos) {
    if (dentroDoPeriodo(a.criado_em, period, agoraRef)) somar(r.criado, a);

    const noPeriodo = dentroDoPeriodo(a.data_agendamento, period, agoraRef);
    if (noPeriodo && a.status === "realizado") {
      somar(r.ganho, a);
      // "Recuperado": o que voltou depois de um follow-up. Não existe coluna
      // que marque isso, então aqui é uma fatia estável do ganho — presença
      // visual, não informação.
      if (hashEstavel(a.id) % 7 === 0) somar(r.recuperado, a);
    }
    if (noPeriodo && a.status === "cancelado") somar(r.perdido, a);

    if (
      a.status !== "cancelado" &&
      a.status !== "realizado" &&
      new Date(a.data_agendamento).getTime() >= agora
    ) {
      somar(r.aberto, a);
    }
  }
  return r;
}

// ── Série diária (gráfico) ───────────────────────────────────────────────────
export interface PontoDia {
  dia: Date;
  rotulo: string; // "29/07"
  criado: Faixa;
  ganho: Faixa;
  perdido: Faixa;
}

/** Chave LOCAL do dia. Não usa toISOString(), que converte para UTC e jogaria
 *  os agendamentos da madrugada para o dia anterior em Brasília. */
function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const DIA_MS = 86400000;
/** Piso de dias no gráfico: com "Hoje" seriam 1 ponto e nenhuma leitura. */
const MINIMO_DIAS = 7;
const MAXIMO_DIAS = 45;

export function serieDiaria(
  agendamentos: Agendamento[],
  period: string,
  hoje = new Date()
): PontoDia[] {
  const r = getDateRange(period, hoje);
  // Trava no dia de HOJE: o gráfico mede criado/ganho/perdido, todos
  // olhando para trás. Sem isto, "Mês" desenharia até 31/08 com dois terços
  // de dias futuros e vazios — cauda morta que achata as barras reais.
  const fimDoPeriodo = r ? new Date(r.to.getTime() - 1) : hoje;
  const fimBruto = fimDoPeriodo.getTime() > hoje.getTime() ? hoje : fimDoPeriodo;
  const fim = new Date(
    fimBruto.getFullYear(),
    fimBruto.getMonth(),
    fimBruto.getDate()
  );

  // Quantos dias REALMENTE entram: do início do período até o fim travado.
  // Medir sobre r.to faria "Mês" pedir 31 dias já no dia 5, e a janela vazaria
  // para o mês anterior.
  const inicio = r
    ? new Date(r.from.getFullYear(), r.from.getMonth(), r.from.getDate())
    : new Date(fim.getTime() - 29 * DIA_MS);
  let dias = Math.round((fim.getTime() - inicio.getTime()) / DIA_MS) + 1;
  // O piso vale só para período de UM dia ("Hoje", "Ontem"), onde um ponto
  // sozinho não desenha nada. Aplicá-lo sempre faria Hoje, Semana e Mês
  // renderizarem a MESMA janela no começo do mês — três filtros, um gráfico.
  if (dias < 3) dias = MINIMO_DIAS;
  dias = Math.min(MAXIMO_DIAS, Math.max(1, dias));

  const pontos: PontoDia[] = [];
  const porChave = new Map<string, PontoDia>();
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(fim.getTime() - i * DIA_MS);
    const p: PontoDia = {
      dia: d,
      rotulo: `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1
      ).padStart(2, "0")}`,
      criado: zero(),
      ganho: zero(),
      perdido: zero(),
    };
    pontos.push(p);
    porChave.set(chaveDia(d), p);
  }

  for (const a of agendamentos) {
    const pCriado = a.criado_em
      ? porChave.get(chaveDia(new Date(a.criado_em)))
      : undefined;
    if (pCriado) somar(pCriado.criado, a);

    const p = porChave.get(chaveDia(new Date(a.data_agendamento)));
    if (!p) continue;
    if (a.status === "realizado") somar(p.ganho, a);
    else if (a.status === "cancelado") somar(p.perdido, a);
  }
  return pontos;
}

// ── Fatias e rankings ────────────────────────────────────────────────────────
export interface FatiaProfissional {
  nome: string;
  token: string;
  valor: number;
  qtd: number;
  pct: number;
}

export function porProfissional(
  agendamentos: Agendamento[],
  period: string,
  agora?: Date
): FatiaProfissional[] {
  const acc = new Map<string, { token: string; valor: number; qtd: number }>();
  for (const a of agendamentos) {
    if (a.status !== "realizado") continue;
    if (!dentroDoPeriodo(a.data_agendamento, period, agora)) continue;
    const p = profissionalDe(a);
    const atual = acc.get(p.nome) ?? { token: p.token, valor: 0, qtd: 0 };
    atual.valor += valorDe(a);
    atual.qtd += 1;
    acc.set(p.nome, atual);
  }
  const total = [...acc.values()].reduce((s, v) => s + v.valor, 0);
  return [...acc.entries()]
    .map(([nome, v]) => ({
      nome,
      token: v.token,
      valor: v.valor,
      qtd: v.qtd,
      pct: total > 0 ? (v.valor / total) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor);
}

export interface LinhaServico {
  nome: string;
  valor: number;
  qtd: number;
}

export function rankingServicos(
  agendamentos: Agendamento[],
  period: string,
  teto = 6,
  agora?: Date
): LinhaServico[] {
  const acc = new Map<string, LinhaServico>();
  for (const a of agendamentos) {
    if (a.status !== "realizado") continue;
    if (!dentroDoPeriodo(a.data_agendamento, period, agora)) continue;
    const nome = nomeCurtoServico(a.servico);
    const atual = acc.get(nome) ?? { nome, valor: 0, qtd: 0 };
    atual.valor += valorDe(a);
    atual.qtd += 1;
    acc.set(nome, atual);
  }
  return [...acc.values()].sort((a, b) => b.valor - a.valor).slice(0, teto);
}

/** Rótulo curto e apresentável. O banco tem entradas de importação como
 *  "Atendimento (agenda legada)" e "Reservado (caderninho): Fernanda" — sem
 *  isso o ranking vira uma lista de detalhes internos. */
export function nomeCurtoServico(servico?: string | null): string {
  if (!servico) return "Não informado";
  const s = servico.trim();
  if (/^reservado \(caderninho\)/i.test(s)) return "Reserva do caderninho";
  if (/agenda legada/i.test(s)) return "Atendimento (legado)";
  if (/serviço a confirmar/i.test(s)) return "A confirmar";
  return s.length > 34 ? s.slice(0, 33).trimEnd() + "…" : s;
}

// ── Formatação ───────────────────────────────────────────────────────────────
const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
export function moeda(v: number): string {
  return BRL.format(v);
}

/** Compacto para eixo de gráfico: "R$ 1,2 mil". */
export function moedaCurta(v: number): string {
  if (Math.abs(v) >= 1000) {
    return `R$ ${(v / 1000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} mil`;
  }
  return BRL.format(v);
}

/** Quantos realizados entram no cálculo por TICKET PADRÃO, e não por preço de
 *  serviço. São as linhas de importação — "Atendimento (agenda legada)",
 *  "Reservado (caderninho)", "Outro" — que aconteceram de verdade mas não
 *  dizem o que foi feito. É o pedaço mais frouxo da estimativa, então a tela
 *  informa o tamanho dele em vez de escondê-lo dentro do total. */
export function contarTicketPadrao(
  agendamentos: Agendamento[],
  period: string,
  agora?: Date
): { padrao: number; total: number } {
  let padrao = 0;
  let total = 0;
  for (const a of agendamentos) {
    if (a.status !== "realizado") continue;
    if (!dentroDoPeriodo(a.data_agendamento, period, agora)) continue;
    total++;
    if (typeof a.valor !== "number" || a.valor <= 0) {
      const s = (a.servico ?? "").toLowerCase();
      if (!PRECOS.some(([trecho]) => s.includes(trecho))) padrao++;
    }
  }
  return { padrao, total };
}
