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
  tipo: string; // "retomada" | "reativacao" | "pos_atendimento" | …
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

// "retomada" → "Retomada". Fallback: capitaliza o que vier.
const TIPO_LABEL: Record<string, string> = {
  retomada: "Retomada",
  reativacao: "Reativação",
  pos_atendimento: "Pós-atendimento",
};
export function tipoLabel(tipo: string): string {
  return TIPO_LABEL[tipo] ?? tipo.charAt(0).toUpperCase() + tipo.slice(1);
}

/** Tipos presentes nos dados, para montar o filtro sem chumbar a lista. */
export function tiposPresentes(fs: FollowUp[]): string[] {
  return [...new Set(fs.map((f) => f.tipo))].sort();
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
