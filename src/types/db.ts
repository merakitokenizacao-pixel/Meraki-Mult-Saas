// Tipos das 5 tabelas do Supabase (schema descrito no CLAUDE.md).
// O banco JÁ EXISTE; estes tipos só refletem o que o front lê/escreve.

// Unions com fallback de string: o n8n pode gravar status fora da lista.
type Loose<T extends string> = T | (string & {});

export type LeadStatus = Loose<"novo" | "agendado" | "convertido" | "cancelado">;
// Os cinco do CHECK de `agendamentos`. `faltou` estava faltando aqui e no
// mapa de badges — conferido contra o banco em ago/2026.
export type AgendamentoStatus = Loose<
  "pendente" | "confirmado" | "cancelado" | "realizado" | "faltou"
>;
export type ConversaOrigem = "cliente" | "agente" | "humano";

export interface Lead {
  id: string;
  nome: string | null;
  telefone: string;
  status: LeadStatus;
  canal: string | null;
  foto_url: string | null;
  nao_lidas: number | null;
  ia_pausada: boolean | null;
  pausada_por: string | null;
  resumo_ia: string | null;
  aceita_campanha: boolean | null;
  /** Tipos de envio automático dos quais esta cliente está dispensada.
   *  Vazio/nulo = recebe tudo. Ver `envio_pode` e lib/envios.ts. */
  dispensa_envios?: string[] | null;
  ultima_interacao: string | null;
  criado_em: string;
  pausada_em?: string | null;
  motivo_pausa?: string | null;
}
// `score_ia`, `temperatura`, `tags` e `origem` foram REMOVIDAS de `leads` em
// ago/2026 e não voltam. ⚠️ `agendamentos.origem` existe (valores 'ia' ou nulo)
// — é outra coluna, não confundir. O canal do lead é `canal`.

export interface Conversa {
  id: string;
  lead_id: string;
  /** Texto da mensagem OU, quando há mídia, um placeholder do n8n no formato
   *  `[o cliente mandou uma foto]`. No áudio, guarda a transcrição. */
  mensagem: string;
  origem: ConversaOrigem;
  enviado_em: string;
  // ── Mídia (bucket privado `midia-conversas`) ──
  // Opcionais porque 7.061 das 7.064 linhas são anteriores à captura: elas não
  // têm mídia e não há como recuperar — o base64 só existia no instante do
  // webhook.
  media_tipo?: "image" | "audio" | null;
  media_path?: string | null;
  media_mimetype?: string | null;
  media_tamanho?: number | null;
  /** Segundos. O ogg/opus do WhatsApp costuma vir sem duração no cabeçalho, e
   *  o navegador reporta Infinity — este é o valor de que o player depende. */
  media_duracao?: number | null;
}

export interface Agendamento {
  id: string;
  lead_id: string;
  servico: string | null;
  data_agendamento: string;
  duracao_min: number | null;
  /** Para QUEM é o horário, quando difere do dono do WhatsApp. A tool
   *  `Criar_Agendamento` da agente preenche; o painel exibe. Nulo = é o
   *  próprio titular. */
  nome_cliente?: string | null;
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


// ── fichas_avaliacao ────────────────────────────────────────────────────────
// Dado de saúde: só trafega server-side (RLS ligada, sem policies).
export type FichaStatus = Loose<"pendente" | "preenchida" | "revisada">;

// Chaves gravadas no jsonb `respostas` — contrato com o n8n, não renomear.
export interface FichaRespostas {
  nome: string;
  data_nascimento: string; // YYYY-MM-DD
  dermatite_alergia: boolean;
  dermatite_alergia_detalhe?: string;
  medicamento: boolean;
  medicamento_qual?: string;
  doenca_autoimune: boolean;
  bronzeamento: boolean;
  bronzeamento_dias?: number;
  foliculite: boolean;
  gestante: boolean;
  problema_hormonal: boolean;
  pelos_loiros_brancos: boolean;
  tatuagem: boolean;
  tatuagem_onde?: string;
  laser_antes: boolean;
  laser_antes_tempo?: string;
  uso_acido: boolean;
  uso_acido_qual?: string;
  melasma: boolean;
  marcapasso: boolean;
}

export interface FichaAvaliacao {
  id: string; // é o token do link público
  lead_id: string | null;
  agendamento_id: string | null;
  tipo: Loose<"laser">;
  respostas: FichaRespostas | null;
  alertas: string[] | null;
  status: FichaStatus;
  criado_em: string;
  preenchida_em: string | null;
}

