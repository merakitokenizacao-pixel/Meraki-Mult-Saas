// Tipos das 5 tabelas do Supabase (schema descrito no CLAUDE.md).
// O banco JÁ EXISTE; estes tipos só refletem o que o front lê/escreve.

// Unions com fallback de string: o n8n pode gravar status fora da lista.
type Loose<T extends string> = T | (string & {});

export type LeadStatus = Loose<"novo" | "agendado" | "convertido" | "cancelado">;
export type AgendamentoStatus = Loose<
  "pendente" | "confirmado" | "cancelado" | "realizado"
>;
export type CampanhaStatus = Loose<
  "rascunho" | "enviando" | "concluida" | "pausada"
>;
export type ConversaOrigem = "cliente" | "agente" | "humano";
export type EnvioStatus = Loose<"pendente" | "enviado" | "falhou">;

export interface Lead {
  id: string;
  nome: string | null;
  telefone: string;
  status: LeadStatus;
  canal: string | null;
  origem: string | null;
  foto_url: string | null;
  nao_lidas: number | null;
  ia_pausada: boolean | null;
  pausada_por: string | null;
  resumo_ia: string | null;
  score_ia: number | null;
  aceita_campanha: boolean | null;
  ultima_interacao: string | null;
  criado_em: string;
  // Campos opcionais lidos/escritos pelas Conversas (podem não existir no banco;
  // o legacy os lê defensivamente e o n8n preenche alguns).
  temperatura?: string | null;
  tags?: string | string[] | null;
  pausada_em?: string | null;
  motivo_pausa?: string | null;
}

export interface Conversa {
  id: string;
  lead_id: string;
  mensagem: string;
  origem: ConversaOrigem;
  enviado_em: string;
}

export interface Agendamento {
  id: string;
  lead_id: string;
  servico: string | null;
  data_agendamento: string;
  duracao_min: number | null;
  status: AgendamentoStatus;
  origem: string | null;
  valor: number | null;
  profissional: string | null;
  criado_em: string; // quando a consulta foi MARCADA (default now() no banco)
}

// Agendamento com o lead embutido (join usado na Agenda).
export interface AgendamentoComLead extends Agendamento {
  leads: Pick<Lead, "nome" | "telefone" | "foto_url"> | null;
}

export interface Campanha {
  id: string;
  nome: string;
  mensagem: string;
  publico: string | null;
  status: CampanhaStatus;
  total: number | null;
  enviados: number | null;
  criado_em: string;
}

export interface CampanhaEnvio {
  id: string;
  campanha_id: string;
  lead_id: string;
  telefone: string;
  nome: string | null;
  status: EnvioStatus;
}
