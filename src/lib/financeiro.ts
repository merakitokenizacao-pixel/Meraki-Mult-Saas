// Camada financeira da aba Negócios — lógica pura, sem I/O, testável.
//
// ⚠️ O QUE É REAL E O QUE NÃO É
//
// REAL: quais agendamentos existem, quando, com que status e de que serviço.
//
// PREÇO: vem do CATÁLOGO da clínica (`documentos_lins`), a mesma base que a
// Laura lê no WhatsApp — não de uma tabela chutada aqui dentro. Quando o texto
// do agendamento é genérico ("Limpeza de pele", que tem 4 variantes), usa a
// média da família; quando é um pacote com promoção, usa o preço do pacote.
// O que não dá para identificar ("Outro", caderninho, agenda legada) fica SEM
// preço — chutar um ticket padrão foi o que fazia o total mentir.
//
// QUEM ATENDEU: não fica mais aqui. Saiu para src/lib/atribuicao.ts, e passou
// a ser derivado da ESCALA (quem estava de plantão), não de hash.

import type { Agendamento } from "@/types/db";
import { getDateRange } from "@/lib/date";
import {
  resolverServico,
  type PromocaoPreco,
  type ServicoCatalogo,
} from "@/lib/servicos";

// ── Preço ────────────────────────────────────────────────────────────────────
// NÃO existe tabela de preços aqui, e não pode voltar a existir: os valores são
// da clínica e moram em `documentos_lins`. Ver src/lib/servicos.ts.

/** Contexto de preço, montado uma vez por render e passado adiante. */
export interface Precos {
  catalogo: ServicoCatalogo[];
  promocoes: PromocaoPreco[];
}

export const SEM_PRECOS: Precos = { catalogo: [], promocoes: [] };

/**
 * Valor de um agendamento. Prefere o do banco (quando o n8n passar a gravar);
 * senão resolve pelo catálogo. Devolve `null` quando não dá para saber — quem
 * soma decide o que fazer com isso, em vez de receber um chute disfarçado.
 */
export function valorDe(a: Agendamento, p: Precos = SEM_PRECOS): number | null {
  if (typeof a.valor === "number" && a.valor > 0) return a.valor;
  return resolverServico(a.servico, p.catalogo, p.promocoes).preco;
}

// (A lista de profissionais e a atribuição por hash saíram daqui. Quem
// atendeu agora vem da escala — src/lib/atribuicao.ts. Manter o hash ao lado
// convidaria a usar o errado de novo.)

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
}

const zero = (): Faixa => ({ valor: 0, qtd: 0 });
// A quantidade conta SEMPRE; o valor só entra quando existe. Um atendimento
// sem preço identificado aconteceu de verdade — some da soma de dinheiro, não
// da contagem.
function somar(f: Faixa, a: Agendamento, precos: Precos): void {
  f.valor += valorDe(a, precos) ?? 0;
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
  precos: Precos = SEM_PRECOS,
  agoraRef: Date = new Date()
): ResumoFinanceiro {
  const r: ResumoFinanceiro = {
    criado: zero(),
    ganho: zero(),
    perdido: zero(),
    aberto: zero(),
  };
  const agora = agoraRef.getTime();

  for (const a of agendamentos) {
    if (dentroDoPeriodo(a.criado_em, period, agoraRef)) somar(r.criado, a, precos);

    const noPeriodo = dentroDoPeriodo(a.data_agendamento, period, agoraRef);
    if (noPeriodo && a.status === "realizado") {
      somar(r.ganho, a, precos);
    }
    if (noPeriodo && a.status === "cancelado") somar(r.perdido, a, precos);

    if (
      a.status !== "cancelado" &&
      a.status !== "realizado" &&
      new Date(a.data_agendamento).getTime() >= agora
    ) {
      somar(r.aberto, a, precos);
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
/** Teto de DIAS varridos, não de pontos desenhados. Só existe para não montar
 *  um laço absurdo se alguém pedir "tudo" com anos de base — a partir de 90
 *  dias os pontos já vêm agrupados por mês. */
const MAXIMO_DIAS = 800;

export type Granularidade = "dia" | "semana" | "mes";

/**
 * Quantos dias cabem num ponto.
 *
 * Com 3 meses por DIA são ~90 pontos em 969px: 3,6px por dia. Nenhum
 * tratamento de traço salva isso — ruído desenhado com gradiente continua
 * sendo ruído. Agrupado por semana viram 13 pontos, e a FORMA aparece.
 */
export function granularidadeDe(dias: number): Granularidade {
  if (dias <= 14) return "dia";
  if (dias <= 90) return "semana";
  return "mes";
}

export const ROTULO_GRANULARIDADE: Record<Granularidade, string> = {
  dia: "por dia",
  semana: "por semana",
  mes: "por mês",
};

const MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** Segunda-feira da semana do dia — o balde começa nela. */
function inicioDaSemana(d: Date): Date {
  const dow = d.getDay(); // 0 = domingo
  const recuo = dow === 0 ? 6 : dow - 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - recuo);
}

function somaFaixa(destino: Faixa, origem: Faixa): void {
  destino.valor += origem.valor;
  destino.qtd += origem.qtd;
}

/**
 * Junta os pontos diários em baldes de semana ou mês.
 *
 * A agregação é SOMA nos dois modos — valor e quantidade. Média faria o
 * gráfico de "Ganhos" cair pela metade ao trocar de dia para semana, como se
 * a clínica tivesse faturado menos.
 *
 * O rótulo usa a data de INÍCIO do balde: "08/07" é a semana que começa em 8
 * de julho, não uma média que aconteceu naquele dia.
 */
export function agruparPontos(
  pontos: PontoDia[],
  granularidade: Granularidade
): PontoDia[] {
  if (granularidade === "dia") return pontos;

  const baldes = new Map<string, PontoDia>();
  for (const p of pontos) {
    const ini =
      granularidade === "semana"
        ? inicioDaSemana(p.dia)
        : new Date(p.dia.getFullYear(), p.dia.getMonth(), 1);
    const chave = chaveDia(ini);
    let b = baldes.get(chave);
    if (!b) {
      b = {
        dia: ini,
        rotulo:
          granularidade === "semana"
            ? `${String(ini.getDate()).padStart(2, "0")}/${String(
                ini.getMonth() + 1
              ).padStart(2, "0")}`
            : MESES_CURTOS[ini.getMonth()],
        criado: zero(),
        ganho: zero(),
        perdido: zero(),
      };
      baldes.set(chave, b);
    }
    somaFaixa(b.criado, p.criado);
    somaFaixa(b.ganho, p.ganho);
    somaFaixa(b.perdido, p.perdido);
  }
  // Ordem cronológica: o Map preserva inserção, e os pontos já chegam em
  // ordem — mas ordenar explicitamente protege de mudança no chamador.
  return [...baldes.values()].sort((a, b) => a.dia.getTime() - b.dia.getTime());
}

/**
 * A série que o gráfico desenha, já na granularidade certa para o período.
 *
 * Devolve a granularidade junto porque a tela precisa DIZER qual está em uso:
 * sem isso, "R$ 4.200" num ponto de semana é lido como um dia.
 */
export function serieDoPeriodo(
  agendamentos: Agendamento[],
  period: string,
  precos: Precos = SEM_PRECOS,
  hoje = new Date()
): { pontos: PontoDia[]; granularidade: Granularidade } {
  const diarios = serieDiaria(agendamentos, period, precos, hoje);
  const g = granularidadeDe(diarios.length);
  return { pontos: agruparPontos(diarios, g), granularidade: g };
}

export function serieDiaria(
  agendamentos: Agendamento[],
  period: string,
  precos: Precos = SEM_PRECOS,
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
    if (pCriado) somar(pCriado.criado, a, precos);

    const p = porChave.get(chaveDia(new Date(a.data_agendamento)));
    if (!p) continue;
    if (a.status === "realizado") somar(p.ganho, a, precos);
    else if (a.status === "cancelado") somar(p.perdido, a, precos);
  }
  return pontos;
}

// ── Fatias e rankings ────────────────────────────────────────────────────────

export interface LinhaServico {
  nome: string;
  valor: number;
  qtd: number;
}

export function rankingServicos(
  agendamentos: Agendamento[],
  period: string,
  precos: Precos = SEM_PRECOS,
  teto = 6,
  agora?: Date
): LinhaServico[] {
  const acc = new Map<string, LinhaServico>();
  for (const a of agendamentos) {
    if (a.status !== "realizado") continue;
    if (!dentroDoPeriodo(a.data_agendamento, period, agora)) continue;
    const nome = nomeCurtoServico(a.servico);
    const atual = acc.get(nome) ?? { nome, valor: 0, qtd: 0 };
    atual.valor += valorDe(a, precos) ?? 0;
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
export function contarSemPreco(
  agendamentos: Agendamento[],
  period: string,
  precos: Precos = SEM_PRECOS,
  agora?: Date
): { semPreco: number; total: number } {
  let semPreco = 0;
  let total = 0;
  for (const a of agendamentos) {
    if (a.status !== "realizado") continue;
    if (!dentroDoPeriodo(a.data_agendamento, period, agora)) continue;
    total++;
    if (valorDe(a, precos) == null) semPreco++;
  }
  return { semPreco, total };
}
