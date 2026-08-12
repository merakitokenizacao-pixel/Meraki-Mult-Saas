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
// Rampa do dourado, do passo mais escuro ao mais claro.
//
// Já foi duas coisas erradas antes: primeiro os tokens de STATUS (que começavam
// em --vx-accent e --vx-gold, então a rosca pintava duas fatias douradas
// competindo com o item ativo do menu), depois uma paleta categórica de matizes
// distintos — correta como método, mas magenta e oliva numa marca dourada eram
// quatro cores saturadas brigando num círculo de 165px.
//
// Agora a cor codifica GRANDEZA, não identidade: um matiz só, cinco passos.
// Os valores estão no CSS porque precisam de um passo por tema (uma rampa que
// clareia até quase o branco desaparece no tema claro).
const TOKENS = [
  "--vx-cat-1",
  "--vx-cat-2",
  "--vx-cat-3",
  "--vx-cat-4",
  "--vx-cat-5",
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

  // A cor segue o POSTO — e isso está certo aqui, porque a cor mudou de
  // trabalho. Ela era paleta categórica (um matiz por pessoa: a cor dizia
  // QUEM) e virou uma rampa do dourado (a cor diz QUANTO). Numa rampa, o
  // passo É a ordem: a fatia mais escura é a maior, e amarrar isso a um
  // critério estável como o alfabeto quebraria justamente a leitura.
  //
  // Quem responde "quem" passou a ser a legenda ao lado, que traz nome, %% e
  // valor em cada linha. Identidade por texto, grandeza por cor.

  const fatias = [...acc.entries()]
    .sort((a, b) => b[1].valor - a[1].valor)
    .map(([nome, v], i) => ({
      nome,
      token: TOKENS[i % TOKENS.length],
      valor: v.valor,
      qtd: v.qtd,
      pct: total > 0 ? (v.valor / total) * 100 : 0,
    }));

  return { fatias, exatos, rateados, semEscala };
}
