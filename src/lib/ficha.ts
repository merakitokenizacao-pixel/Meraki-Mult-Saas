// Lógica pura da ficha de avaliação do laser: perguntas, validação e alertas.
// Sem I/O e sem React — roda igual no servidor (route handler) e no cliente
// (validação otimista do formulário). A fonte de verdade é sempre o servidor.
import type { FichaRespostas } from "@/types/db";

// ── Perguntas ───────────────────────────────────────────────────────────────
// A ordem aqui é a ordem do formulário E a ordem da leitura no painel.
// `detalhe` é o campo condicional que aparece quando a resposta é "sim".

export type ChaveBool = Extract<
  keyof FichaRespostas,
  | "dermatite_alergia"
  | "medicamento"
  | "doenca_autoimune"
  | "bronzeamento"
  | "foliculite"
  | "gestante"
  | "problema_hormonal"
  | "pelos_loiros_brancos"
  | "tatuagem"
  | "laser_antes"
  | "uso_acido"
  | "melasma"
  | "marcapasso"
>;

export type Detalhe = {
  key: keyof FichaRespostas;
  label: string;
  tipo: "text" | "number";
  placeholder?: string;
};

export type Pergunta = {
  key: ChaveBool;
  label: string;
  detalhe?: Detalhe;
};

export const PERGUNTAS: readonly Pergunta[] = [
  {
    key: "dermatite_alergia",
    label: "Você tem dermatite ou alguma alergia?",
    detalhe: {
      key: "dermatite_alergia_detalhe",
      label: "Qual?",
      tipo: "text",
      placeholder: "Ex.: alergia a níquel",
    },
  },
  {
    key: "medicamento",
    label: "Faz uso de algum medicamento?",
    detalhe: {
      key: "medicamento_qual",
      label: "Qual medicamento?",
      tipo: "text",
      placeholder: "Ex.: Roacutan",
    },
  },
  { key: "doenca_autoimune", label: "Possui alguma doença autoimune?" },
  {
    key: "bronzeamento",
    label: "Se bronzeou recentemente (sol, praia ou artificial)?",
    detalhe: {
      key: "bronzeamento_dias",
      label: "Há quantos dias?",
      tipo: "number",
      placeholder: "Ex.: 10",
    },
  },
  { key: "foliculite", label: "Costuma ter foliculite (pelos encravados)?" },
  { key: "gestante", label: "Está gestante?" },
  { key: "problema_hormonal", label: "Tem algum problema hormonal?" },
  { key: "pelos_loiros_brancos", label: "Tem pelos loiros e brancos?" },
  {
    key: "tatuagem",
    label: "Tem tatuagem na área do procedimento?",
    detalhe: {
      key: "tatuagem_onde",
      label: "Em qual local?",
      tipo: "text",
      placeholder: "Ex.: antebraço direito",
    },
  },
  {
    key: "laser_antes",
    label: "Já fez laser antes?",
    detalhe: {
      key: "laser_antes_tempo",
      label: "Há quanto tempo foi a última sessão?",
      tipo: "text",
      placeholder: "Ex.: 3 meses",
    },
  },
  {
    key: "uso_acido",
    label: "Está usando algum ácido na pele?",
    detalhe: {
      key: "uso_acido_qual",
      label: "Qual ácido?",
      tipo: "text",
      placeholder: "Ex.: ácido salicílico",
    },
  },
  { key: "melasma", label: "Tem melasma?" },
  { key: "marcapasso", label: "Usa marcapasso?" },
] as const;

// ── Alertas ─────────────────────────────────────────────────────────────────
// Calculados SEMPRE no servidor a partir das respostas — o cliente nunca envia
// alertas. Contraindicações vêm primeiro (a equipe lê de cima pra baixo).

export function calcularAlertas(r: FichaRespostas): string[] {
  const alertas: string[] = [];
  if (r.gestante) alertas.push("CONTRAINDICACAO_GESTANTE");
  if (r.marcapasso) alertas.push("CONTRAINDICACAO_MARCAPASSO");
  if (
    r.bronzeamento &&
    typeof r.bronzeamento_dias === "number" &&
    r.bronzeamento_dias < 15
  ) {
    alertas.push("ATENCAO_BRONZEAMENTO_RECENTE");
  }
  if (r.uso_acido) alertas.push("ATENCAO_USO_ACIDO");
  if (r.dermatite_alergia) alertas.push("ATENCAO_ALERGIA");
  if (r.doenca_autoimune) alertas.push("ATENCAO_AUTOIMUNE");
  if (r.medicamento) alertas.push("ATENCAO_MEDICAMENTO");
  if (r.pelos_loiros_brancos) alertas.push("ATENCAO_EFICACIA_PELOS_CLAROS");
  if (r.tatuagem) alertas.push("ATENCAO_TATUAGEM");
  if (r.melasma) alertas.push("ATENCAO_MELASMA");
  return alertas;
}

export function isContraindicacao(alerta: string): boolean {
  return alerta.startsWith("CONTRAINDICACAO_");
}

// Rótulos legíveis para o painel (Entrega 2).
export const ALERTA_LABEL: Record<string, string> = {
  CONTRAINDICACAO_GESTANTE: "Gestante — contraindicação",
  CONTRAINDICACAO_MARCAPASSO: "Usa marcapasso — contraindicação",
  ATENCAO_BRONZEAMENTO_RECENTE: "Bronzeamento há menos de 15 dias",
  ATENCAO_USO_ACIDO: "Em uso de ácido",
  ATENCAO_ALERGIA: "Dermatite ou alergia",
  ATENCAO_AUTOIMUNE: "Doença autoimune",
  ATENCAO_MEDICAMENTO: "Uso de medicamento",
  ATENCAO_EFICACIA_PELOS_CLAROS: "Pelos loiros/brancos — eficácia reduzida",
  ATENCAO_TATUAGEM: "Tatuagem na área",
  ATENCAO_MELASMA: "Melasma",
};

export function alertaLabel(alerta: string): string {
  return ALERTA_LABEL[alerta] ?? alerta;
}

// ── Validação ───────────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTokenValido(token: string): boolean {
  return UUID_RE.test(token);
}

export type ParseResult =
  | { ok: true; data: FichaRespostas }
  | { ok: false; erros: Partial<Record<keyof FichaRespostas, string>> };

function textoValido(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Valida e normaliza o payload cru do formulário.
 * Regras: nome e data de nascimento obrigatórios; todos os booleanos
 * respondidos; e o campo condicional preenchido quando a resposta for "sim"
 * (é o detalhe que a equipe precisa para avaliar o risco).
 */
export function parseRespostas(input: unknown): ParseResult {
  const erros: Partial<Record<keyof FichaRespostas, string>> = {};
  const raw = (input ?? {}) as Record<string, unknown>;

  const nome = typeof raw.nome === "string" ? raw.nome.trim() : "";
  if (nome.length < 2) erros.nome = "Informe seu nome completo.";
  else if (nome.length > 120) erros.nome = "Nome muito longo.";

  const nasc = typeof raw.data_nascimento === "string" ? raw.data_nascimento : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nasc)) {
    erros.data_nascimento = "Informe sua data de nascimento.";
  } else {
    // Meio-dia evita que o fuso empurre a data para o dia anterior.
    const d = new Date(nasc + "T12:00:00");
    const ano = Number(nasc.slice(0, 4));
    if (Number.isNaN(d.getTime()) || ano < 1900) {
      erros.data_nascimento = "Data de nascimento inválida.";
    } else if (d.getTime() > Date.now()) {
      erros.data_nascimento = "A data não pode estar no futuro.";
    }
  }

  const out: Record<string, unknown> = { nome, data_nascimento: nasc };

  for (const p of PERGUNTAS) {
    const v = raw[p.key];
    if (typeof v !== "boolean") {
      erros[p.key] = "Responda sim ou não.";
      continue;
    }
    out[p.key] = v;
    if (!p.detalhe) continue;

    // Detalhe só é guardado quando a resposta é "sim" (evita lixo no jsonb).
    if (!v) continue;
    const dv = raw[p.detalhe.key];
    if (p.detalhe.tipo === "number") {
      const n = typeof dv === "number" ? dv : Number(dv);
      if (!Number.isFinite(n) || n < 0 || n > 3650) {
        erros[p.detalhe.key] = "Informe um número de dias válido.";
      } else {
        out[p.detalhe.key] = Math.trunc(n);
      }
    } else if (!textoValido(dv)) {
      erros[p.detalhe.key] = "Preencha este campo.";
    } else {
      out[p.detalhe.key] = (dv as string).trim().slice(0, 300);
    }
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, data: out as unknown as FichaRespostas };
}

// ── Formatação ──────────────────────────────────────────────────────────────

// "quinta-feira, 17 de julho" — fuso fixo da clínica, pois o servidor roda em UTC.
export function formatDiaProcedimento(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(d);
}

export function formatDataNascimento(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
