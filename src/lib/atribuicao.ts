// Quem atendeu — derivado da ESCALA, não de hash.
//
// `agendamentos.profissional_id` é nulo em 100% das linhas, então não dá para
// saber com certeza quem atendeu. Mas a escala (`profissional_horarios`) diz
// quem estava TRABALHANDO naquele dia e hora, e isso já elimina o chute: nunca
// se atribui atendimento a quem não estava lá.
//
// Duas situações, e a tela precisa saber a proporção de cada uma:
//   · uma profissional de plantão  → atribuição EXATA (37% dos realizados hoje)
//   · várias                       → o valor é RATEADO entre elas, em partes
//                                    iguais. É o estimador sem viés: no
//                                    agregado, ninguém sai favorecida.
//
// Rateio em vez de sorteio de propósito. Escolher uma por hash daria um número
// preciso e errado; dividir dá um número aproximado e honesto — e o total por
// profissional continua somando exatamente o faturamento do período.

export interface FaixaEscala {
  profissional_id: string;
  dia_semana: number; // 0=dom
  hora_inicio: string; // "13:00:00"
  hora_fim: string; // "20:00:00"
}

export interface Profissional {
  id: string;
  nome: string;
  ativo?: boolean | null;
}

/** Hora cheia local do agendamento. O horário é gravado em timestamptz e o
 *  navegador da clínica está em Brasília — `getDay`/`getHours` já entregam o
 *  local, que é o mesmo fuso da escala. */
function quandoLocal(iso: string): { dow: number; hora: number } {
  const d = new Date(iso);
  return { dow: d.getDay(), hora: d.getHours() };
}

const horaDe = (t: string): number => Number(t.split(":")[0]);

/** Quem estava de plantão naquele instante. */
export function dePlantao(
  iso: string,
  escala: FaixaEscala[]
): string[] {
  const { dow, hora } = quandoLocal(iso);
  const ids = new Set<string>();
  for (const f of escala) {
    if (f.dia_semana !== dow) continue;
    // A faixa 13:00–20:00 cobre as horas 13..19: quem sai às 20h não começa
    // atendimento às 20h.
    if (hora >= horaDe(f.hora_inicio) && hora < horaDe(f.hora_fim)) {
      ids.add(f.profissional_id);
    }
  }
  return [...ids];
}

export interface FatiaProfissional {
  nome: string;
  token: string;
  valor: number;
  /** Fracionário: um atendimento rateado entre 3 conta 0,33 para cada. */
  qtd: number;
  pct: number;
}

/**
 * Quantidade fracionária em texto.
 *
 * O rateio produz números como 32.333333333333314, e o valor cru vazava para
 * a tela. Uma casa decimal basta: a fração existe para a soma fechar com o
 * faturamento, não para ser lida com precisão de ponto flutuante.
 */
export function qtdTexto(q: number): string {
  const arred = Math.round(q * 10) / 10;
  return Number.isInteger(arred)
    ? String(arred)
    : arred.toFixed(1).replace(".", ",");
}

export interface ResultadoAtribuicao {
  fatias: FatiaProfissional[];
  /** Atendimentos com uma só profissional de plantão. */
  exatos: number;
  /** Rateados entre duas ou mais. */
  rateados: number;
  /** Sem ninguém na escala naquela hora — ficam de fora. */
  semEscala: number;
}

// Cor por TOKEN, não hex: a tabela `profissionais` guarda cores da paleta clara
// (#3a6b4f, #2a5278…), que somem sobre superfície escura — medido em ~2:1 no
// tema Escuro pela revisão adversarial.
// Paleta CATEGÓRICA própria, não os tokens de status.
//
// Antes esta lista começava em --mk-accent e terminava em --mk-gold: a rosca
// pintava duas fatias douradas, mais dois pontos de legenda e dois avatares,
// tudo disputando com o item ativo do menu — que é o único lugar onde essa cor
// precisa querer dizer alguma coisa.
//
// Reusar status também estava errado por si: verde/vermelho/âmbar significam
// SITUAÇÃO em toda a interface, e como paleta categórica reprovavam
// (vermelho↔âmbar dava ΔE 11,1 para visão normal, com piso em 15).
const TOKENS = [
  "--mk-cat-1",
  "--mk-cat-2",
  "--mk-cat-3",
  "--mk-cat-4",
  "--mk-cat-5",
];

/**
 * Distribui o valor dos atendimentos entre quem estava de plantão.
 * `itens` já vem filtrado (só realizados, só do período).
 */
export function atribuirPorEscala(
  itens: Array<{ data_agendamento: string; valor: number | null }>,
  escala: FaixaEscala[],
  profissionais: Profissional[]
): ResultadoAtribuicao {
  const nomePorId = new Map(profissionais.map((p) => [p.id, p.nome]));
  const acc = new Map<string, { valor: number; qtd: number }>();
  let exatos = 0;
  let rateados = 0;
  let semEscala = 0;

  for (const it of itens) {
    const ids = dePlantao(it.data_agendamento, escala).filter((id) =>
      nomePorId.has(id)
    );
    if (ids.length === 0) {
      semEscala++;
      continue;
    }
    if (ids.length === 1) exatos++;
    else rateados++;

    // Atendimento sem preço identificado ainda CONTA como atendimento; só não
    // soma dinheiro. Zerar a contagem esconderia trabalho que aconteceu.
    const fatiaValor = (it.valor ?? 0) / ids.length;
    const fatiaQtd = 1 / ids.length;
    for (const id of ids) {
      const nome = nomePorId.get(id) as string;
      const atual = acc.get(nome) ?? { valor: 0, qtd: 0 };
      atual.valor += fatiaValor;
      atual.qtd += fatiaQtd;
      acc.set(nome, atual);
    }
  }

  const total = [...acc.values()].reduce((s, v) => s + v.valor, 0);

  // A cor segue a PESSOA, nunca o posto dela. Antes vinha do índice na lista
  // ordenada por valor: bastava trocar o período para a Mônica cair de 1º para
  // 2º e as duas primeiras fatias trocarem de cor — a mesma profissional
  // mudando de cor entre dois recortes, e a rosca deixando de ser comparável
  // com ela mesma. A ordem alfabética é estável, independe dos números e
  // sobrevive a alguém entrar ou sair do período.
  const ordemFixa = [...acc.keys()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const corDe = (nome: string) =>
    TOKENS[ordemFixa.indexOf(nome) % TOKENS.length];

  const fatias = [...acc.entries()]
    .sort((a, b) => b[1].valor - a[1].valor)
    .map(([nome, v]) => ({
      nome,
      token: corDe(nome),
      valor: v.valor,
      qtd: v.qtd,
      pct: total > 0 ? (v.valor / total) * 100 : 0,
    }));

  return { fatias, exatos, rateados, semEscala };
}
