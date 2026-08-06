// Formatação e recorte de período do Financeiro. Lógica pura, sem I/O.
//
// ⚠️ NÃO EXISTE MAIS TABELA DE PREÇO AQUI, e não pode voltar a existir.
// O valor de um atendimento é `agendamentos.valor` — um SNAPSHOT gravado pelo
// trigger `agendamentos_precificar` no momento da criação. Recalcular por join
// com `procedimentos` reescreveria o passado: se a drenagem subir em setembro,
// os atendimentos de agosto mudariam de valor retroativamente.
//
// A régua conceitual, que a tela precisa manter separada:
//   PREVISTO  = agendamento futuro pendente ou confirmado. Pipeline, não caixa.
//   FATURADO  = atendimento realizado. Serviço entregue.
//   RECEBIDO  = soma de `pagamentos`. Dinheiro que entrou.
// Os três nunca batem, e está certo que não batam.

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function moeda(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? Number(v) : (v ?? 0);
  return BRL.format(Number.isFinite(n) ? n : 0);
}

/** numeric do Postgres chega como STRING via PostgREST. */
export function num(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// ── Período ──────────────────────────────────────────────────────────────────
// `financeiro_resumo` recebe `date`, não timestamp, e converte para
// America/São_Paulo por dentro. Aqui só precisamos entregar YYYY-MM-DD do dia
// LOCAL — nunca `toISOString()`, que passa por UTC e jogaria 1º de agosto às
// 00h de Brasília para 31 de julho.

export interface IntervaloISO {
  de: string; // YYYY-MM-DD
  ate: string; // YYYY-MM-DD — INCLUSIVO (verificado contra a função)
}

function diaLocalISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const DIA_MS = 86400000;

/**
 * Converte o período nomeado da caixinha para o intervalo da função.
 * `getDateRange().to` é EXCLUSIVO e `p_ate` é INCLUSIVO — por isso o cálculo
 * aqui é próprio, e não uma adaptação daquele.
 */
export function intervaloDoPeriodo(
  period: string,
  agora: Date = new Date()
): IntervaloISO {
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  switch (period) {
    case "hoje":
      return { de: diaLocalISO(hoje), ate: diaLocalISO(hoje) };
    case "ontem": {
      const o = new Date(hoje.getTime() - DIA_MS);
      return { de: diaLocalISO(o), ate: diaLocalISO(o) };
    }
    case "semana": {
      const inicio = new Date(hoje.getTime() - hoje.getDay() * DIA_MS);
      return {
        de: diaLocalISO(inicio),
        ate: diaLocalISO(new Date(inicio.getTime() + 6 * DIA_MS)),
      };
    }
    case "mes": {
      const ini = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
      return { de: diaLocalISO(ini), ate: diaLocalISO(fim) };
    }
    default:
      // "tudo": não há registro antes de 2020, e o fim vai um ano à frente
      // para não cortar agendamento marcado longe.
      return {
        de: "2020-01-01",
        ate: diaLocalISO(new Date(agora.getFullYear() + 1, 11, 31)),
      };
  }
}

/** Intervalo do dia em ISO completo, para filtrar colunas timestamptz. */
export function limitesTimestamp(iv: IntervaloISO): { de: string; ate: string } {
  return {
    de: new Date(`${iv.de}T00:00:00`).toISOString(),
    // Fim do dia LOCAL do `ate` inclusivo → início do dia seguinte, exclusivo.
    ate: new Date(
      new Date(`${iv.ate}T00:00:00`).getTime() + DIA_MS
    ).toISOString(),
  };
}

// ── Vocabulário ──────────────────────────────────────────────────────────────
export const FORMAS = [
  { valor: "pix", label: "Pix" },
  { valor: "dinheiro", label: "Dinheiro" },
  { valor: "credito", label: "Crédito" },
  { valor: "debito", label: "Débito" },
  { valor: "link", label: "Link" },
  { valor: "cortesia", label: "Cortesia" },
  { valor: "outro", label: "Outro" },
] as const;

export const TIPOS_PAGAMENTO = [
  { valor: "integral", label: "Integral" },
  { valor: "sinal", label: "Sinal" },
  { valor: "parcela", label: "Parcela" },
  { valor: "estorno", label: "Estorno" },
] as const;

export const STATUS_ATENDIMENTO = [
  { valor: "", label: "Todos os status" },
  { valor: "realizado", label: "Realizado" },
  { valor: "pendente", label: "Pendente" },
  { valor: "confirmado", label: "Confirmado" },
  { valor: "cancelado", label: "Cancelado" },
] as const;

// Chave `string`, não a união literal: o que vem do banco é text solto, e
// indexar um Record tipado com ele quebraria o build.
const ROTULO_FORMA = new Map<string, string>(
  FORMAS.map((f) => [f.valor, f.label])
);
export function rotuloForma(f: string | null | undefined): string {
  return ROTULO_FORMA.get(f ?? "") ?? "Outro";
}

/** Nome do catálogo quando existe; texto livre do agendamento quando não. */
export function nomeDoAtendimento(
  procedimento: string | null,
  servicoTexto: string | null
): string {
  return procedimento || servicoTexto || "Sem serviço";
}

/** Agrupa somando `valor`, ordenado do maior para o menor. */
export function agruparPorValor<T>(
  itens: T[],
  chave: (i: T) => string | null,
  valor: (i: T) => number,
  teto = 8
): Array<{ nome: string; valor: number; qtd: number }> {
  const acc = new Map<string, { nome: string; valor: number; qtd: number }>();
  for (const i of itens) {
    const nome = chave(i) || "Sem classificação";
    const atual = acc.get(nome) ?? { nome, valor: 0, qtd: 0 };
    atual.valor += valor(i);
    atual.qtd += 1;
    acc.set(nome, atual);
  }
  return [...acc.values()].sort((a, b) => b.valor - a.valor).slice(0, teto);
}

// ── Série diária (gráfico "Dados diários") ───────────────────────────────────
// Volta a existir, mas agora somando `agendamentos.valor` — o SNAPSHOT real
// gravado pelo trigger. Antes somava uma tabela de preços chutada aqui dentro.

export interface Faixa {
  valor: number;
  qtd: number;
}
export interface PontoDia {
  dia: Date;
  rotulo: string; // "29/07"
  criado: Faixa;
  ganho: Faixa;
  perdido: Faixa;
}

/** Chave LOCAL do dia. Nunca `toISOString()`, que passa por UTC e jogaria o
 *  atendimento da madrugada para o dia anterior em Brasília. */
function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const MINIMO_DIAS = 7;
const MAXIMO_DIAS = 45;

interface LinhaSerie {
  criado_em: string | null;
  data_agendamento: string;
  status: string;
  valor: number | string | null;
}

export function serieDiaria(
  linhas: LinhaSerie[],
  period: string,
  hoje: Date = new Date()
): PontoDia[] {
  const iv = intervaloDoPeriodo(period, hoje);
  const inicioPeriodo = new Date(`${iv.de}T00:00:00`);
  const fimPeriodo = new Date(`${iv.ate}T00:00:00`);
  const hojeDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  // Trava no dia de HOJE: o gráfico mede criado/ganho/perdido, todos olhando
  // para trás. Sem isto, "Mês" desenharia até o dia 31 com dois terços de dias
  // futuros e vazios — cauda morta que achata as barras reais.
  const fim = fimPeriodo > hojeDia ? hojeDia : fimPeriodo;

  let dias = Math.round((fim.getTime() - inicioPeriodo.getTime()) / DIA_MS) + 1;
  // O piso vale só para período de UM dia ("Hoje", "Ontem"), onde um ponto
  // sozinho não desenha nada. Aplicá-lo sempre faria Hoje, Semana e Mês
  // renderizarem a MESMA janela no começo do mês — três filtros, um gráfico.
  if (dias < 3) dias = MINIMO_DIAS;
  dias = Math.min(MAXIMO_DIAS, Math.max(1, dias));

  const zero = (): Faixa => ({ valor: 0, qtd: 0 });
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

  for (const l of linhas) {
    const v = num(l.valor);
    if (l.criado_em) {
      const pc = porChave.get(chaveDia(new Date(l.criado_em)));
      if (pc) {
        pc.criado.valor += v;
        pc.criado.qtd += 1;
      }
    }
    const p = porChave.get(chaveDia(new Date(l.data_agendamento)));
    if (!p) continue;
    if (l.status === "realizado") {
      p.ganho.valor += v;
      p.ganho.qtd += 1;
    } else if (l.status === "cancelado") {
      p.perdido.valor += v;
      p.perdido.qtd += 1;
    }
  }
  return pontos;
}

// ── Fatias por profissional (rosca) ──────────────────────────────────────────
export interface FatiaProfissional {
  nome: string;
  /** Token de cor, não hex: a tabela `profissionais` guarda hex da paleta
   *  CLARA, que sobre superfície escura fica em ~2:1 e some. */
  token: string;
  valor: number;
  qtd: number;
  pct: number;
}

const TOKENS_PROFISSIONAL = [
  "--vx-accent",
  "--vx-green",
  "--vx-blue",
  "--vx-red",
  "--vx-purple",
  "--vx-gold",
];

export function fatiasPorProfissional(
  linhas: Array<{ profissional: string | null; valor: number | string | null }>
): FatiaProfissional[] {
  const acc = new Map<string, { valor: number; qtd: number }>();
  for (const l of linhas) {
    if (!l.profissional) continue;
    const atual = acc.get(l.profissional) ?? { valor: 0, qtd: 0 };
    atual.valor += num(l.valor);
    atual.qtd += 1;
    acc.set(l.profissional, atual);
  }
  const total = [...acc.values()].reduce((s, v) => s + v.valor, 0);
  return [...acc.entries()]
    .sort((a, b) => b[1].valor - a[1].valor)
    .map(([nome, v], i) => ({
      nome,
      token: TOKENS_PROFISSIONAL[i % TOKENS_PROFISSIONAL.length],
      valor: v.valor,
      qtd: v.qtd,
      pct: total > 0 ? (v.valor / total) * 100 : 0,
    }));
}

/** Compacto para eixo de gráfico: "R$ 9,9 mil". */
export function moedaCurta(v: number | string | null | undefined): string {
  const n = num(v);
  if (Math.abs(n) >= 1000) {
    return `R$ ${(n / 1000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} mil`;
  }
  return moeda(n);
}
