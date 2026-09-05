// Catálogo de serviços da clínica — lógica pura, sem I/O.
//
// A FONTE é `documentos`, a mesma base que a agente lê no WhatsApp. Isso é
// deliberado: se o preço do CRM viesse de uma tabela paralela, a agente diria
// um valor e a tela mostraria outro. Um lugar só, os dois leem.
//
// O preço mora no TEXTO do documento (a coluna `metadata` está vazia), então
// aqui há um parser. Ele é tolerante de propósito: documento sem preço legível
// devolve `null` e a tela mostra isso, em vez de inventar um número.

export interface ServicoCatalogo {
  id: string;
  nome: string;
  categoria: string;
  /** Preço de referência da sessão avulsa. `null` = não deu para ler. */
  preco: number | null;
  /** Quando o documento dá faixa ("de R$ 80 a R$ 220") ou preço por área. */
  faixa: { min: number; max: number } | null;
  /** Como o preço foi obtido — a tela precisa poder dizer isso. */
  origem: "fixo" | "faixa" | "a-partir-de" | "media-por-area" | "sem-preco";
  /** Termos que o texto livre do agendamento pode usar. */
  sinonimos: string[];
}

/** Remove acento e caixa — o texto do agendamento vem do WhatsApp, sem padrão
 *  ("Drenagem linfatica", "drenagem linfática", "DRENAGEM"). */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Todos os "R$ 1.234,56" de um trecho, em número. */
function valoresDoTexto(texto: string): number[] {
  const achados = texto.matchAll(/R\$\s*([\d.]+(?:,\d{2})?)/g);
  const out: number[] = [];
  for (const m of achados) {
    const n = Number(m[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

const media = (ns: number[]) =>
  Math.round((ns.reduce((s, n) => s + n, 0) / ns.length) * 100) / 100;

/**
 * Preço de referência a partir do conteúdo do documento.
 *
 * Formatos que aparecem de verdade na base:
 *   "Preço: R$ 100,00"                              → fixo
 *   "Preço: de R$ 80,00 a R$ 220,00 conforme..."    → faixa, usa a MÉDIA
 *   "Preço: a partir de R$ 180,00"                  → piso
 *   "Preço: R$ 180,00 na clínica ou R$ 300,00 ..."  → o primeiro (o da clínica)
 *   sem linha "Preço:" (laser e cera)               → média das áreas listadas
 *
 * A média é a escolha certa para faixa e para área: um atendimento anônimo de
 * "depilação a laser" pode ter sido buço (R$ 20) ou perna inteira (R$ 95), e a
 * média é o estimador sem viés entre os dois extremos.
 */
export function precoDoConteudo(conteudo: string): {
  preco: number | null;
  faixa: { min: number; max: number } | null;
  origem: ServicoCatalogo["origem"];
} {
  const linha = /Preço:\s*([^\n]+)/.exec(conteudo)?.[1];

  if (linha) {
    const vs = valoresDoTexto(linha);
    if (vs.length === 0) return { preco: null, faixa: null, origem: "sem-preco" };
    if (/\bde\s+R\$/i.test(linha) && /\ba\s+R\$/i.test(linha) && vs.length >= 2) {
      const min = Math.min(...vs);
      const max = Math.max(...vs);
      return { preco: media([min, max]), faixa: { min, max }, origem: "faixa" };
    }
    if (/a partir de/i.test(linha)) {
      return { preco: vs[0], faixa: null, origem: "a-partir-de" };
    }
    // "R$ 180,00 na clínica ou R$ 300,00 na residência": o primeiro é o padrão.
    return { preco: vs[0], faixa: null, origem: "fixo" };
  }

  // Sem linha de preço: laser e cera cobram POR ÁREA, com dezenas de valores.
  // Pega só o bloco de valores por área — os COMBOS são pacote de várias
  // sessões e entrariam como se fossem sessão avulsa, inflando a média.
  const areas = conteudo
    .split(/\n\s*\n/)
    .filter((b) => /Valores?\s.*por área/i.test(b))
    .join("\n");
  const vs = valoresDoTexto(areas);
  if (vs.length >= 3) {
    return {
      preco: media(vs),
      faixa: { min: Math.min(...vs), max: Math.max(...vs) },
      origem: "media-por-area",
    };
  }
  return { preco: null, faixa: null, origem: "sem-preco" };
}

export function sinonimosDoConteudo(conteudo: string): string[] {
  const linha = /Sinônimos:\s*([^\n]+)/.exec(conteudo)?.[1];
  if (!linha) return [];
  return linha
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Monta uma entrada do catálogo a partir da linha crua do documento. */
export function montarServico(doc: {
  id: string;
  nome: string;
  categoria: string | null;
  conteudo: string | null;
  tags: string[] | null;
}): ServicoCatalogo {
  const conteudo = doc.conteudo ?? "";
  const p = precoDoConteudo(conteudo);
  return {
    id: doc.id,
    nome: doc.nome,
    categoria: doc.categoria ?? "outros",
    preco: p.preco,
    faixa: p.faixa,
    origem: p.origem,
    sinonimos: sinonimosDoConteudo(conteudo),
  };
}

/**
 * Casa o texto livre de `agendamentos.servico` com uma entrada do catálogo.
 *
 * Ordem importa: primeiro o nome exato, depois sinônimo exato, e só então
 * "contém". Sem essa ordem, "Limpeza de Pele nas Costas" casaria com
 * "Limpeza de Pele com LED" por conter as mesmas palavras iniciais.
 */
export function casarServico(
  texto: string | null | undefined,
  catalogo: ServicoCatalogo[]
): ServicoCatalogo | null {
  if (!texto) return null;
  const t = normalizar(texto);
  if (!t) return null;

  const porNome = catalogo.find((s) => normalizar(s.nome) === t);
  if (porNome) return porNome;

  for (const s of catalogo) {
    if (s.sinonimos.some((sin) => normalizar(sin) === t)) return s;
  }

  // "Contém" avaliado do nome MAIS LONGO para o mais curto: assim
  // "Limpeza de Pele + Microagulhamento" ganha de "Microagulhamento".
  const porTrecho = [...catalogo]
    .sort((a, b) => b.nome.length - a.nome.length)
    .find((s) => t.includes(normalizar(s.nome)));
  if (porTrecho) return porTrecho;

  for (const s of [...catalogo].sort(
    (a, b) =>
      Math.max(...b.sinonimos.map((x) => x.length), 0) -
      Math.max(...a.sinonimos.map((x) => x.length), 0)
  )) {
    // Sinônimo curto ("laser", "cera") só vale como palavra inteira, senão
    // "Massagem Relaxante" casaria com qualquer coisa que contenha "sa".
    if (
      s.sinonimos.some((sin) => {
        const n = normalizar(sin);
        return n.length >= 4 && new RegExp(`\\b${escapar(n)}\\b`).test(t);
      })
    ) {
      return s;
    }
  }
  return null;
}

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Famílias ────────────────────────────────────────────────────────────────
// O texto do agendamento costuma ser genérico ("Limpeza de pele") enquanto o
// documento é específico (4 variantes: LED 120, Peeling de Diamante 160, com
// Microagulhamento 250, nas Costas 210). Sem isso, 21 atendimentos de limpeza
// ficavam sem preço.
//
// A família resolve pela MÉDIA dos irmãos — é o estimador sem viés quando não
// se sabe qual variante foi feita. E fica marcado como "familia", para a tela
// poder distinguir do preço exato.
const FAMILIAS: ReadonlyArray<{ chave: string; termo: RegExp }> = [
  { chave: "Limpeza de pele", termo: /limpeza de pele/ },
  { chave: "Peeling", termo: /peeling/ },
  { chave: "Drenagem linfática", termo: /drenagem/ },
  { chave: "Depilação", termo: /depilacao/ },
  { chave: "Massagem", termo: /massagem/ },
  { chave: "Taping", termo: /taping|tapping/ },
];

// ── Promoções e pacotes ─────────────────────────────────────────────────────
// Segunda fonte real: a tabela `promocoes`, que a dona mantém. O texto do
// agendamento muitas vezes É o título da promoção ("Pacote Copa de Massagem",
// "Combo Laser Day 24/07"), e aí o preço certo é o do pacote inteiro.
export interface PromocaoPreco {
  titulo: string;
  preco: number | null;
}

/**
 * O preço de uma promoção.
 *
 * ⚠️ `promocoes.valor_promocional` é `numeric` NO BANCO, e o PostgREST entrega
 * numeric como NÚMERO. O tipo aqui dizia `string | null`, o `?? ""` não pega
 * número nenhum, e `valoresDoTexto` acabava chamando `.matchAll` num number:
 * `TypeError: texto.matchAll is not a function`, e a rota inteira caía em 500
 * assim que existiu UMA promoção ativa.
 *
 * O parser de "R$ …" existe para o CONTEÚDO dos documentos, onde o preço mora
 * dentro de uma frase. Aqui ele nunca deveria ter entrado: o valor já é o
 * número. A string continua atendida porque a coluna aceita `"499.90"` e
 * porque texto livre pode ter sobrado de importação.
 */
function precoDaPromocao(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  const direto = Number(v);
  if (Number.isFinite(direto) && direto > 0) return direto;
  // "25% de desconto no Pix" não tem valor absoluto — fica nulo.
  return valoresDoTexto(v)[0] ?? null;
}

export function montarPromocoes(
  linhas: Array<{ titulo: string; valor_promocional: number | string | null }>
): PromocaoPreco[] {
  return linhas.map((p) => ({
    titulo: p.titulo,
    preco: precoDaPromocao(p.valor_promocional),
  }));
}

/** Pacote/combo NÃO pode cair na média de sessão avulsa: um pacote de 10
 *  drenagens custa R$ 499,90 e viraria R$ 125. Melhor sem preço do que com um
 *  que subestima em 4×. */
const EH_PACOTE = /\b(pacote|combo|plano)\b/;

export interface ResolucaoServico {
  /** Entrada exata do catálogo, quando o texto identificou uma. */
  servico: ServicoCatalogo | null;
  /** Média da família, quando o texto era genérico. */
  familia: { nome: string; membros: number } | null;
  preco: number | null;
  precisao: "promocao" | "exato" | "familia" | "desconhecido";
}

/**
 * Resolve o texto livre de `agendamentos.servico` em preço.
 *
 * Três saídas, e a tela precisa saber qual foi:
 *   exato        → casou com um serviço do documento
 *   familia      → texto genérico; preço é a média das variantes
 *   desconhecido → não dá para saber ("Outro", caderninho, agenda legada)
 *
 * `desconhecido` devolve preço NULO de propósito. Chutar um ticket padrão foi
 * o que fez o total mentir antes: 69 atendimentos entravam por R$ 100 sem que
 * nada no dado sustentasse isso.
 */
export function resolverServico(
  texto: string | null | undefined,
  catalogo: ServicoCatalogo[],
  promocoes: PromocaoPreco[] = []
): ResolucaoServico {
  const t = normalizar(texto ?? "");

  // 1º a promoção: quando o agendamento foi marcado com o título dela, o preço
  // certo é o do pacote inteiro, não o da sessão.
  for (const p of promocoes) {
    if (p.preco == null) continue;
    const n = normalizar(p.titulo);
    if (t === n || (n.length >= 8 && t.includes(n))) {
      return {
        servico: null,
        familia: { nome: p.titulo, membros: 1 },
        preco: p.preco,
        precisao: "promocao",
      };
    }
  }

  const exato = casarServico(texto, catalogo);
  if (exato) {
    return { servico: exato, familia: null, preco: exato.preco, precisao: "exato" };
  }

  // Pacote sem promoção casada fica SEM preço: a média de avulso subestimaria
  // em várias vezes, e um número errado pra menos engana mais que um vazio.
  if (t && EH_PACOTE.test(t)) {
    return { servico: null, familia: null, preco: null, precisao: "desconhecido" };
  }

  if (t) {
    for (const f of FAMILIAS) {
      if (!f.termo.test(t)) continue;
      const membros = catalogo.filter(
        (s) => f.termo.test(normalizar(s.nome)) && s.preco != null
      );
      if (membros.length === 0) continue;
      return {
        servico: null,
        familia: { nome: f.chave, membros: membros.length },
        preco: media(membros.map((s) => s.preco as number)),
        precisao: "familia",
      };
    }
  }

  return { servico: null, familia: null, preco: null, precisao: "desconhecido" };
}

/** Ordena para o seletor: por categoria e depois por nome, em pt-BR. */
export function ordenarParaSelecao(
  catalogo: ServicoCatalogo[]
): ServicoCatalogo[] {
  return [...catalogo].sort(
    (a, b) =>
      a.categoria.localeCompare(b.categoria, "pt-BR") ||
      a.nome.localeCompare(b.nome, "pt-BR")
  );
}

export const ROTULO_CATEGORIA: Record<string, string> = {
  bandagem: "Bandagem",
  corporal: "Corporal",
  depilacao: "Depilação",
  drenagem: "Drenagem",
  facial: "Facial",
  massagem: "Massagem",
  pacote: "Pacote",
  pes: "Pés",
  outros: "Outros",
};
