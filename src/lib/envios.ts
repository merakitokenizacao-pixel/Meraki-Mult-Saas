// Envios automáticos: as regras de QUANDO o sistema pode falar sozinho.
//
// Toda mensagem automática passa por UM porteiro só — `envio_pode(tenant, lead,
// tipo)` —, e essa função não tem regra dentro: lê tudo de `envios_regras`.
// Esta biblioteca é a leitura em português da mesma tabela.
//
// ⚠️ POR QUE ISSO EXISTE. No sistema anterior cada rotina tinha a própria regra,
// ou nenhuma: uma cliente com 34 agendamentos recebeu 7 mensagens num dia. Aqui
// a regra é DADO, e a clínica mexe sem ninguém tocar em código.

/** Os quatro tipos semeados. A tela NÃO cria tipo novo — a PK é
 *  `(tenant_id, tipo)` e as quatro linhas já existem. */
export const TIPOS_ENVIO = [
  "lembrete",
  "retomada",
  "compromisso",
  "reativacao",
] as const;
export type TipoEnvio = (typeof TIPOS_ENVIO)[number];

export const ROTULO_ENVIO: Record<TipoEnvio, { nome: string; quando: string }> = {
  lembrete: {
    nome: "Lembrete de véspera",
    quando: "avisa antes do atendimento",
  },
  retomada: { nome: "Retomada", quando: "cliente parou de responder" },
  compromisso: { nome: "Compromisso", quando: "ela disse que voltaria" },
  reativacao: { nome: "Reativação", quando: "sumiu faz tempo" },
};

/**
 * As receitas de FOLLOW-UP, isto é: quais tipos de `envios_regras` são retomada
 * de conversa. A tela de Follow-ups mostra estas, com o `ativo` real do banco.
 *
 * ⚠️ `lembrete` NÃO é follow-up: ele avisa ANTES do atendimento, não retoma
 * conversa nenhuma. Por isso é `null` aqui.
 *
 * ⚠️ E SÓ EXISTEM TRÊS. O desenho pedia cinco receitas — faltam "Faltou" e
 * "Depois do atendimento", que não têm linha em `envios_regras`. Escrevê-las
 * aqui à mão daria uma lista que a tela mostra e o porteiro `envio_pode` não
 * conhece: ele recusa tipo sem regra ("sem regra configurada"), então seriam
 * duas receitas que nunca disparam. Quando as linhas existirem, entram aqui.
 */
export const RECEITA_FOLLOWUP: Record<
  TipoEnvio,
  { nome: string; gatilho: string } | null
> = {
  lembrete: null,
  compromisso: {
    nome: "Prometeu voltar",
    gatilho: "ela mesma disse que voltaria, e a data chegou",
  },
  retomada: {
    nome: "Recebeu preço e sumiu",
    gatilho: "perguntou o valor e não marcou",
  },
  reativacao: {
    nome: "Sumiu faz tempo",
    gatilho: "muito tempo sem contato",
  },
};

export interface RegraEnvio {
  tipo: TipoEnvio;
  ativo: boolean;
  /** Só no lembrete: quantas horas ANTES do atendimento. */
  antecedencia_horas: number | null;
  /** Nos follow-ups: quantas horas DEPOIS da última mensagem. */
  atraso_horas: number | null;
  janela_inicio: string;
  janela_fim: string;
  /** `smallint[]`, domingo = 0. */
  dias_semana: number[];
  min_horas_apos_criacao: number;
  max_por_lead_dia: number;
  max_por_lead_periodo: number;
  periodo_dias: number;
  respeita_pausa: boolean;
  respeita_optout: boolean;
  pular_se_frequente: boolean;
  frequente_min_visitas: number;
  frequente_dias: number;
}

/** Domingo = 0, como `extract(dow)` no Postgres — é o que `envio_pode` compara. */
export const DIAS = [
  [0, "D"],
  [1, "S"],
  [2, "T"],
  [3, "Q"],
  [4, "Q"],
  [5, "S"],
  [6, "S"],
] as const;

const NOME_DIA = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

/**
 * Horas em unidade legível. Guardar em horas e mostrar em dias é o que evita
 * a dona ter que dividir 720 por 24 para conferir a própria regra.
 */
export function emUnidade(horas: number | null): string {
  if (horas == null) return "—";
  if (horas < 24) return `${horas} hora${horas === 1 ? "" : "s"}`;
  const dias = horas / 24;
  if (Number.isInteger(dias)) {
    return `${dias} dia${dias === 1 ? "" : "s"}`;
  }
  return `${horas} horas`;
}

/** "09:00:00" → "09:00". O input `type=time` não aceita os segundos. */
export function hhmm(t: string): string {
  return (t ?? "").slice(0, 5);
}

/** Sequência de dias vira "de segunda a sábado"; salteada vira lista. */
function frasedosDias(dias: number[]): string {
  const ord = [...new Set(dias)].sort((a, b) => a - b);
  if (ord.length === 0) return "em nenhum dia";
  if (ord.length === 7) return "todos os dias";
  const sequencia = ord.every((d, i) => i === 0 || d === ord[i - 1] + 1);
  if (sequencia && ord.length > 2) {
    return `de ${NOME_DIA[ord[0]]} a ${NOME_DIA[ord[ord.length - 1]]}`;
  }
  const nomes = ord.map((d) => NOME_DIA[d]);
  return nomes.length === 1
    ? `só ${nomes[0]}`
    : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/**
 * A regra inteira em português, montada dos valores atuais.
 *
 * ⚠️ ESTE É O CONTROLE DE VERDADE DA TELA. Regra escrita em número é difícil de
 * conferir — sete campos e um array não dizem o que vai acontecer. A mesma
 * regra escrita em frase a dona lê e diz na hora se está certa ou não.
 */
export function previa(r: RegraEnvio): string {
  if (!r.ativo) return "Este envio está desligado — nada é mandado.";

  const partes: string[] = [];

  if (r.tipo === "lembrete" && r.antecedencia_horas != null) {
    partes.push(`Avisamos ${emUnidade(r.antecedencia_horas)} antes`);
  } else if (r.atraso_horas != null) {
    partes.push(`Mandamos ${emUnidade(r.atraso_horas)} depois da última mensagem`);
  } else {
    partes.push("Mandamos");
  }

  partes.push(
    `entre ${hhmm(r.janela_inicio)} e ${hhmm(r.janela_fim)}, ${frasedosDias(r.dias_semana)}`
  );

  let texto = partes.join(", ") + ". ";

  texto +=
    `No máximo ${r.max_por_lead_dia} mensagem${r.max_por_lead_dia === 1 ? "" : "s"} ` +
    `por pessoa por dia e ${r.max_por_lead_periodo} a cada ${r.periodo_dias} dias.`;

  const excecoes: string[] = [];
  if (r.pular_se_frequente) {
    excecoes.push(
      `quem já tem ${r.frequente_min_visitas} ou mais atendimentos em ${r.frequente_dias} dias`
    );
  }
  if (r.respeita_pausa) {
    excecoes.push("quem está sendo atendido por alguém da equipe");
  }
  if (r.respeita_optout) excecoes.push("quem pediu para não receber");

  if (excecoes.length === 1) texto += ` Não mandamos para ${excecoes[0]}.`;
  else if (excecoes.length > 1) {
    texto += ` Não mandamos para ${excecoes.slice(0, -1).join(", ")}, nem para ${
      excecoes[excecoes.length - 1]
    }.`;
  }

  return texto;
}
