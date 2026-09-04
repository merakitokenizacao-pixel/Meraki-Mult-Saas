// Para QUEM é o horário — regra pura, sem I/O.
//
// `leads.nome` é o dono do WhatsApp, não necessariamente quem vai ser
// atendido: mãe marcando para filha, marido para esposa, uma amiga para outra.
// A tool `Criar_Agendamento` da agente já grava `agendamentos.nome_cliente`
// quando os dois diferem; o painel é a metade que faltava.
//
// Já aconteceu de verdade: a Mônica atendeu a Maria Dagmar, marcada pelo
// WhatsApp da Ingrid, e o nome da Maria não aparecia em lugar nenhum do painel.

export interface NomesAgendamento {
  /** O que vai na linha principal. Nulo quando os dois lados estão vazios —
   *  quem trata é o componente, com o mesmo texto que já usa para lead sem
   *  nome. */
  exibido: string | null;
  /** Só existe quando difere do exibido. Nulo = não renderiza a segunda linha
   *  (nem espaço reservado, nem "—"). */
  titular: string | null;
}

const limpo = (s?: string | null): string | null => {
  const t = (s ?? "").trim();
  return t.length > 0 ? t : null;
};

/**
 * Devolve DOIS CAMPOS, nunca uma string montada.
 *
 * A alternativa seria concatenar — no SQL ou aqui — algo como
 * `nome_cliente (via Fulano)`. Duas razões para não:
 *
 * 1. `leads.nome` é nulo em 179 dos leads de hoje (lead que chega sem
 *    pushname). Em Postgres `'texto' || null` devolve NULL, então o card
 *    ficaria em branco justo nos casos mais confusos.
 * 2. Com a string pronta, o componente não consegue quebrar em duas linhas nem
 *    apagar o "via" — teria que desmontar com regex o que alguém montou antes.
 */
export function nomesDoAgendamento(
  nomeCliente?: string | null,
  nomeLead?: string | null
): NomesAgendamento {
  const cliente = limpo(nomeCliente);
  const lead = limpo(nomeLead);
  if (!cliente) return { exibido: lead, titular: null };
  // Mesmo nome dos dois lados não é "via ninguém": é a própria pessoa.
  if (!lead || lead === cliente) return { exibido: cliente, titular: null };
  return { exibido: cliente, titular: lead };
}

/** Primeiro nome, para a linha apagada. O completo vai no `title`. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0];
}
