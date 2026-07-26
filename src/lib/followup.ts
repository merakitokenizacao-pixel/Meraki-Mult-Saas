// Lógica pura dos follow-ups: métricas, filtro por período e rótulos.
// Sem I/O — testável isolada e igual no cliente e no servidor.
//
// CONTEXTO (AGENTE.md): um follow-up é UMA mensagem de retomada que o n8n
// envia quando um cliente novo pergunta e some. Antes de escrever, o agente
// decide se cabe insistir; quando NÃO cabe, registra `vetado` — e isso é uma
// decisão CORRETA, não uma falha. A tela nunca trata veto como erro.
//
// O painel só LÊ a view `follow_ups_resultado`. Nada aqui escreve.

export type FollowUpResultado =
  | "convertido" // agendou depois do envio
  | "respondido" // respondeu, mas não agendou
  | "sem_resposta" // não respondeu
  | "vetado"; // a IA decidiu não enviar

export type FollowUp = {
  id: string;
  lead_id: string | null;
  nome: string | null;
  telefone: string | null;
  tipo: string; // ver TIPOS abaixo
  referencia: string | null; // o "porquê" datado do disparo (varia por tipo)
  status: string; // "enviado" | "vetado"
  mensagem: string | null; // null quando vetado
  contexto: string | null;
  enviado_em: string | null;
  primeira_resposta_em: string | null;
  agendou_em: string | null;
  resultado: FollowUpResultado;
};

// ── Período ─────────────────────────────────────────────────────────────────

export type Periodo = 7 | 30 | 90;
export const PERIODOS: readonly Periodo[] = [7, 30, 90];

/**
 * Corte do período no fuso da CLÍNICA (Brasília). O servidor da Vercel roda em
 * UTC; sem fixar o fuso, "há 30 dias" flutuaria três horas e um follow-up de
 * borda entraria ou sairia da conta na virada da madrugada.
 *
 * Devolve o instante ISO a partir do qual um follow-up entra na janela.
 */
export function corteDoPeriodo(dias: Periodo, agora: Date = new Date()): number {
  return agora.getTime() - dias * 24 * 60 * 60 * 1000;
}

/** Filtra pelos que caem na janela (usa `enviado_em`; sem data, fica de fora). */
export function noPeriodo(
  fs: FollowUp[],
  dias: Periodo,
  agora: Date = new Date()
): FollowUp[] {
  const corte = corteDoPeriodo(dias, agora);
  return fs.filter((f) => {
    if (!f.enviado_em) return false;
    return new Date(f.enviado_em).getTime() >= corte;
  });
}

// ── Métricas ────────────────────────────────────────────────────────────────

export type Metricas = {
  enviados: number; // resultado ≠ vetado
  respondidos: number; // respondido + convertido (falaram)
  convertidos: number; // agendaram
  vetados: number;
  taxaResposta: number; // 0..100, arredondada
  taxaConversao: number; // 0..100, arredondada
};

/**
 * As TAXAS são sobre ENVIADOS, nunca sobre o total. Incluir vetado no
 * denominador puniria a clínica por uma decisão correta do agente — quanto
 * mais ele veta bem, pior pareceria a taxa. Por isso vetado fica fora da conta.
 */
export function calcularMetricas(fs: FollowUp[]): Metricas {
  let enviados = 0;
  let respondidos = 0;
  let convertidos = 0;
  let vetados = 0;

  for (const f of fs) {
    if (f.resultado === "vetado") {
      vetados++;
      continue;
    }
    enviados++;
    if (f.resultado === "convertido") convertidos++;
    else if (f.resultado === "respondido") respondidos++;
  }

  const falaram = respondidos + convertidos;
  const pct = (n: number) =>
    enviados > 0 ? Math.round((n / enviados) * 100) : 0;

  return {
    enviados,
    respondidos,
    convertidos,
    vetados,
    taxaResposta: pct(falaram),
    taxaConversao: pct(convertidos),
  };
}

// ── Rótulos (pt-BR, sem jargão) ─────────────────────────────────────────────

export const RESULTADO_LABEL: Record<FollowUpResultado, string> = {
  convertido: "Agendou",
  respondido: "Respondeu",
  sem_resposta: "Sem resposta",
  vetado: "Não enviado",
};

export type Tom = "verde" | "azul" | "cinza" | "ambar";
export const RESULTADO_TOM: Record<FollowUpResultado, Tom> = {
  convertido: "verde",
  respondido: "azul",
  sem_resposta: "cinza",
  vetado: "ambar",
};

/**
 * Os quatro tipos de follow-up, com o GATILHO de cada um.
 *
 * O gatilho não é enfeite: é o que faz a dona confiar no sistema. Sem ele, ela
 * vê "a IA mandou mensagem pra minha cliente" e não sabe por quê. O valor cru
 * (`laser_day`) nunca aparece na interface.
 *
 * Lista FIXA de propósito — a tabela comparativa mostra os quatro mesmo quando
 * um deles não teve nenhum registro no período: dois disparam raramente (Laser
 * Day é mensal; Retorno prometido depende da cliente prometer), e a ausência é
 * informação, não motivo para sumir da tela.
 */
export const TIPOS = [
  {
    valor: "retomada",
    label: "Retomada de conversa",
    gatilho:
      "Cliente novo perguntou sobre um procedimento e não respondeu. A IA retoma 2h depois.",
  },
  {
    valor: "compromisso",
    label: "Retorno prometido",
    gatilho:
      "A própria cliente disse que voltaria numa época, e essa data chegou.",
  },
  {
    valor: "laser_day",
    label: "Laser Day chegando",
    gatilho:
      "Faltam poucos dias para o Laser Day e a cliente tem interesse em laser.",
  },
  {
    valor: "reativacao",
    label: "Cliente sem vir",
    gatilho:
      "60 dias ou mais sem contato, e existe promoção vigente que combina com o que ela fazia.",
  },
] as const;

// Chave `string` (não a união literal): o n8n pode criar um tipo novo antes de
// a tela conhecer, e a busca precisa aceitar qualquer valor sem quebrar o build.
const POR_VALOR = new Map<string, { label: string; gatilho: string }>(
  TIPOS.map((t) => [t.valor, { label: t.label, gatilho: t.gatilho }])
);

export function tipoLabel(tipo: string): string {
  // Fallback para um tipo novo que o n8n crie antes de a tela saber dele:
  // "pos_atendimento" → "Pos atendimento". Melhor que mostrar o valor cru.
  return (
    POR_VALOR.get(tipo)?.label ??
    (tipo.charAt(0).toUpperCase() + tipo.slice(1)).replace(/_/g, " ")
  );
}

export function tipoGatilho(tipo: string): string {
  return POR_VALOR.get(tipo)?.gatilho ?? "";
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/**
 * A `referencia` em português, por extenso — nunca a data crua.
 *
 * Cada tipo guarda uma coisa diferente ali: laser_day guarda a data do Laser
 * Day, compromisso a data que a cliente prometeu, reativacao o mês (AAAA-MM).
 *
 * As datas são lidas do TEXTO, sem passar por `new Date()`: construir um Date
 * a partir de "2026-08-29" o interpreta como UTC e, no fuso de Brasília, exibe
 * 28/08 — um dia a menos. É o mesmo cuidado do resto do projeto.
 */
export function referenciaLabel(
  tipo: string,
  referencia: string | null | undefined
): string {
  const r = referencia?.trim();
  if (!r) return "";

  const dia = /^(\d{4})-(\d{2})-(\d{2})/.exec(r); // 2026-08-29[T...]
  const mes = /^(\d{4})-(\d{2})$/.exec(r); // 2026-08
  const nomeMes = (mm: string) => MESES[Number(mm) - 1] ?? mm;

  switch (tipo) {
    case "laser_day":
      return dia ? `Laser Day de ${dia[3]}/${dia[2]}` : r;
    case "compromisso":
      return dia ? `prometeu voltar em ${dia[3]}/${dia[2]}` : r;
    case "reativacao":
      if (mes) return `reativação de ${nomeMes(mes[2])}`;
      if (dia) return `reativação de ${nomeMes(dia[2])}`;
      return r;
    default:
      // Tipo desconhecido: mostra o que veio, sem inventar rótulo.
      return r;
  }
}

/**
 * Métricas quebradas POR TIPO — a tabela que responde "qual follow-up vale a
 * pena manter". Devolve sempre os quatro tipos conhecidos (mesmo zerados),
 * mais qualquer tipo novo que apareça nos dados.
 *
 * Substituiu a antiga `tiposPresentes`, que derivava a lista dos dados: com
 * ela, um tipo que ainda não disparou simplesmente sumia da tela — e some
 * exatamente a informação de que ele não rodou.
 */
export type LinhaTipo = {
  tipo: string;
  label: string;
  gatilho: string;
  metricas: Metricas;
  vazio: boolean; // nenhum registro no período → mostra traço, não zero
};

export function metricasPorTipo(fs: FollowUp[]): LinhaTipo[] {
  const conhecidos = TIPOS.map((t) => t.valor as string);
  const extras = [...new Set(fs.map((f) => f.tipo))]
    .filter((t) => !conhecidos.includes(t))
    .sort();

  return [...conhecidos, ...extras].map((tipo) => {
    const doTipo = fs.filter((f) => f.tipo === tipo);
    return {
      tipo,
      label: tipoLabel(tipo),
      gatilho: tipoGatilho(tipo),
      metricas: calcularMetricas(doTipo),
      vazio: doTipo.length === 0,
    };
  });
}

// ── Ordenação ───────────────────────────────────────────────────────────────

/** Mais recentes primeiro (por `enviado_em`; nulos ao fim). */
export function ordenarRecentes(fs: FollowUp[]): FollowUp[] {
  return [...fs].sort((a, b) => {
    const ta = a.enviado_em ? new Date(a.enviado_em).getTime() : 0;
    const tb = b.enviado_em ? new Date(b.enviado_em).getTime() : 0;
    return tb - ta;
  });
}
