// Requisitos: "antes de X acontecer, Y precisa estar respondido e válido".
//
// Ficha de contraindicação antes do laser é UM caso. Anamnese odontológica,
// termo de tatuagem e carteira de vacina de pet são os mesmos ossos — por isso
// nada aqui sabe o que é uma clínica de estética. As perguntas, os tipos e a
// regra de alerta vêm todos do banco.
//
// Lógica pura, sem I/O. Quem fala com o Supabase é `requisitos-db.ts`.

/** CHECK de `requisito_campos.tipo`, conferido no banco. */
export const TIPOS = ["sim_nao", "texto", "data", "numero"] as const;
export type TipoCampo = (typeof TIPOS)[number];

export const ROTULO_TIPO: Record<TipoCampo, string> = {
  sim_nao: "Sim ou não",
  texto: "Texto livre",
  data: "Data",
  numero: "Número",
};

export interface Requisito {
  id: string;
  nome: string;
  descricao: string | null;
  validade_dias: number;
  bloqueia: boolean;
  url_base: string | null;
  ativo: boolean;
}

export interface CampoRequisito {
  id: string;
  requisito_id: string;
  ordem: number;
  chave: string;
  pergunta: string;
  tipo: TipoCampo;
  obrigatorio: boolean;
  /** "sim" | "nao" | null. Só faz sentido em `sim_nao`. */
  alerta_se: string | null;
}

/** Uma pergunta como a cliente a recebe (saída de `requisito_formulario`). */
export interface PerguntaPublica {
  chave: string;
  pergunta: string;
  tipo: TipoCampo;
  obrigatorio: boolean;
  ordem: number;
}

export interface FormularioPublico {
  requisito: string;
  descricao: string | null;
  ja_respondido: boolean;
  perguntas: PerguntaPublica[];
}

/** `validade_dias` que significa "nunca vence" — o brief chama assim. */
export const NUNCA_VENCE = 0;
export const ATALHOS_VALIDADE: ReadonlyArray<readonly [number, string]> = [
  [90, "90 dias"],
  [180, "180 dias"],
  [365, "1 ano"],
  [NUNCA_VENCE, "Nunca vence"],
];

/**
 * Gera a `chave` a partir da pergunta: sem acento, sem espaço, sem maiúscula.
 *
 * Ela é IDENTIFICADOR, não texto — vira nome de campo no `jsonb` das respostas
 * e é o que amarra a resposta de hoje à pergunta de um ano atrás.
 */
export function chaveDaPergunta(pergunta: string): string {
  return pergunta
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** A mesma normalização, para quando a pessoa digita a chave à mão. */
export function limparChave(bruta: string): string {
  return chaveDaPergunta(bruta);
}

/**
 * O link que a agente manda no WhatsApp: `url_base` + token.
 *
 * `url_base` é por requisito de propósito — a clínica pode servir o formulário
 * do próprio domínio, e o token é a credencial (não há login).
 */
export function linkDoToken(urlBase: string | null, token: string): string {
  const base = (urlBase ?? "").trim().replace(/\/+$/, "");
  return base ? `${base}/${token}` : token;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ⚠️ O TOKEN É UUID, e isso precisa ser checado ANTES de chamar o banco.
 *
 * `requisito_formulario(p_token uuid)` recebe uuid: um token malformado não
 * devolve zero linhas, levanta `22P02 invalid input syntax for type uuid`. Sem
 * esta guarda, "link errado" chegaria na tela como erro de sistema.
 */
export function ehToken(v: string | null | undefined): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}
