// Lógica pura das promoções: situação, rótulos e as travas de texto.
// Sem I/O — roda no cliente (formulário) e no servidor (route handler), então
// a validação nunca diverge entre os dois.
//
// CONTEXTO CRÍTICO: a tabela `promocoes` é lida AO VIVO pela agente a cada
// mensagem. O que for salvo aqui é falado para clientes reais na conversa
// seguinte — não há deploy, cache nem revisão no meio.

export type Promocao = {
  id: string;
  titulo: string;
  descricao: string;
  procedimento: string | null;
  valor_promocional: string;
  condicao: string | null;
  dia_semana: number | null; // 0=dom … 6=sáb · null = todos os dias
  valida_ate: string | null; // "YYYY-MM-DD" · null = sem prazo
  ativa: boolean;
  anuncio_ativo: boolean;
  criado_em: string;
};

export const DIAS_SEMANA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

// Plural usado no jeito que o agente fala ("vale só às quintas")
const DIAS_PLURAL = [
  "aos domingos",
  "às segundas",
  "às terças",
  "às quartas",
  "às quintas",
  "às sextas",
  "aos sábados",
] as const;

/**
 * Hoje no fuso da CLÍNICA (Brasília), como "YYYY-MM-DD".
 * A virada do dia que importa é a de Brasília — o servidor da Vercel roda em
 * UTC, onde depois das 21h já é "amanhã". Sem isso, uma promoção que vence hoje
 * apareceria como vencida três horas antes da hora.
 */
export function hojeBrasilia(agora: Date = new Date()): string {
  // en-CA formata como YYYY-MM-DD, que é o formato da coluna `date`.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export type Situacao = "vigente" | "vencida" | "desativada";

/**
 * Situação da promoção. A ordem importa: VENCIDA vence sobre desativada,
 * porque o motivo mais informativo de "não está no ar" é o prazo.
 *
 * Detalhe que já mordeu em produção: uma promoção pode estar `ativa = true` e
 * mesmo assim vencida — a agente para de oferecer sozinha, mas a dona continua
 * achando que está no ar. Por isso a lista mostra as vencidas em cinza.
 */
export function situacaoDe(p: Promocao, hoje = hojeBrasilia()): Situacao {
  if (p.valida_ate && p.valida_ate < hoje) return "vencida";
  if (!p.ativa) return "desativada";
  return "vigente";
}

/** É uma das que a agente está oferecendo AGORA? */
export function estaNoAr(p: Promocao, hoje = hojeBrasilia()): boolean {
  return situacaoDe(p, hoje) === "vigente";
}

/** Vigentes primeiro; dentro do grupo, as mais recentes na frente. */
export function ordenar(promos: Promocao[], hoje = hojeBrasilia()): Promocao[] {
  const peso = (p: Promocao) => (situacaoDe(p, hoje) === "vigente" ? 0 : 1);
  return [...promos].sort(
    (a, b) =>
      peso(a) - peso(b) ||
      new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
  );
}

// ── Rótulos ─────────────────────────────────────────────────────────────────

/** "Todos os dias" · "Só às quintas" */
export function quandoVale(dia: number | null): string {
  if (dia === null || dia === undefined) return "Todos os dias";
  const d = DIAS_PLURAL[dia];
  return d ? `Só ${d}` : "Todos os dias";
}

/** "24/07/2026" a partir de "2026-07-24" (sem passar por Date, sem fuso) */
export function dataBR(iso: string | null): string {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** "Sem prazo" · "Até 24/07" · "Venceu em 19/07" */
export function rotuloValidade(p: Promocao, hoje = hojeBrasilia()): string {
  if (!p.valida_ate) return "Sem prazo";
  const [, m, d] = p.valida_ate.split("-");
  return p.valida_ate < hoje ? `Venceu em ${d}/${m}` : `Até ${d}/${m}`;
}

// ── Travas de texto (o padrão de escrita do agente) ─────────────────────────

// Travessão (—), meia-risca (–) e o menos Unicode (−). O hífen comum (-) passa.
// Sem a flag `g` de propósito: regex global guarda `lastIndex` entre chamadas,
// e `.test()` no mesmo objeto passaria a devolver false na 2ª chamada. Para
// substituir (onde `g` é necessário) usamos cópias em `limparTexto`.
const TRACOS = /[—–−]/u;

// Faixas de emoji + pictogramas + bandeiras + seletores de variação.
const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F0FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{200D}]/u;

export type ProblemaTexto = "traco" | "emoji";

/** O que há de proibido neste texto (vazio = está limpo). */
export function problemasDoTexto(texto: string): ProblemaTexto[] {
  const p: ProblemaTexto[] = [];
  if (TRACOS.test(texto)) p.push("traco");
  if (EMOJI.test(texto)) p.push("emoji");
  return p;
}

/**
 * Remove o que o agente não pode falar: troca travessão por hífen e tira emoji.
 * Colar texto do Instagram/Canva quase sempre traz os dois — em vez de barrar
 * e obrigar a dona a caçar o caractere, limpamos e avisamos o que mudou.
 */
export function limparTexto(texto: string): string {
  // Cópias com `g` só aqui — o replace precisa da flag, o test não pode tê-la.
  return texto
    .replace(new RegExp(TRACOS.source, "gu"), "-")
    .replace(new RegExp(EMOJI.source, "gu"), "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function descreverProblemas(p: ProblemaTexto[]): string {
  if (p.length === 0) return "";
  const partes: string[] = [];
  if (p.includes("traco")) partes.push("travessão");
  if (p.includes("emoji")) partes.push("emoji");
  return partes.join(" e ");
}

// ── Pré-visualização: como a agente recebe ───────────────────────────────────

/**
 * Monta a linha no MESMO formato que o agente lê no bloco de promoções
 * injetado no prompt. É a melhor defesa contra texto ruim: a dona vê o
 * resultado antes de salvar.
 */
export function previewAgente(p: {
  titulo: string;
  descricao: string;
  valor_promocional: string;
  condicao: string | null;
  dia_semana: number | null;
  valida_ate: string | null;
}): string {
  const partes = [
    p.titulo.trim(),
    p.descricao.trim(),
    p.valor_promocional.trim(),
  ].filter(Boolean);

  if (p.condicao?.trim()) partes.push(`Condição: ${p.condicao.trim()}`);

  partes.push(
    p.dia_semana === null || p.dia_semana === undefined
      ? "vale todos os dias"
      : `vale só ${DIAS_PLURAL[p.dia_semana]}`
  );

  if (p.valida_ate) {
    const [, m, d] = p.valida_ate.split("-");
    partes.push(`até ${d}/${m}`);
  }

  return partes.join(" | ");
}

// ── Validação do formulário ─────────────────────────────────────────────────

export type CamposPromocao = {
  titulo: string;
  descricao: string;
  procedimento: string | null;
  valor_promocional: string;
  condicao: string | null;
  dia_semana: number | null;
  valida_ate: string | null;
  ativa: boolean;
  anuncio_ativo: boolean;
};

export type ErrosPromocao = Partial<Record<keyof CamposPromocao, string>>;

/** Campos que a agente lê e fala — precisam passar pelas travas de texto. */
export const CAMPOS_FALADOS = [
  "titulo",
  "descricao",
  "valor_promocional",
  "condicao",
] as const;

export function validarPromocao(c: CamposPromocao): ErrosPromocao {
  const erros: ErrosPromocao = {};

  if (!c.titulo.trim()) erros.titulo = "Dê um nome para a promoção.";
  else if (c.titulo.trim().length > 120) erros.titulo = "Nome muito longo.";

  if (!c.descricao.trim()) erros.descricao = "Explique o que a promoção inclui.";
  if (!c.valor_promocional.trim())
    erros.valor_promocional = "Informe o valor como o cliente ouve.";

  // As travas de texto valem para tudo que vai ao WhatsApp.
  for (const campo of CAMPOS_FALADOS) {
    const v = (c[campo] ?? "") as string;
    if (!v) continue;
    const p = problemasDoTexto(v);
    if (p.length > 0) {
      erros[campo] = `Tire ${descreverProblemas(p)} — a agente não usa isso.`;
    }
  }

  if (c.valida_ate && !/^\d{4}-\d{2}-\d{2}$/.test(c.valida_ate)) {
    erros.valida_ate = "Data inválida.";
  }

  return erros;
}
