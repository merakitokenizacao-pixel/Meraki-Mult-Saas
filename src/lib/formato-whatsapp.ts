// Formatação de texto do WhatsApp → árvore de nós. Lógica pura, sem React.
//
// A Laura manda `*negrito*` porque é o que o WhatsApp entende, e a cliente vê
// em negrito no celular. No CRM os asteriscos apareciam crus, então a mesma
// mensagem ficava suja de um lado e formatada do outro.
//
// Devolve uma ÁRVORE, não HTML: a mensagem vem de terceiros (cliente, agente),
// e montar HTML com o texto delas seria porta aberta para injeção. Quem
// renderiza cria elementos React, que escapam por construção.

export type Estilo = "negrito" | "italico" | "riscado" | "mono";

export type No =
  | { tipo: "texto"; valor: string }
  | { tipo: "estilo"; estilo: Estilo; filhos: No[] };

// Ordem importa: ``` precisa ser testado antes de qualquer marca de 1 char,
// senão o primeiro ` de ``` nunca seria alcançado.
const MARCAS: ReadonlyArray<{ marca: string; estilo: Estilo }> = [
  { marca: "```", estilo: "mono" },
  { marca: "*", estilo: "negrito" },
  { marca: "_", estilo: "italico" },
  { marca: "~", estilo: "riscado" },
];

/** Trava contra texto patológico (`***********…`) que faria a recursão explodir. */
const PROFUNDIDADE_MAX = 6;

const ehEspaco = (c: string | undefined) => c === undefined || /\s/.test(c);

/**
 * Índice do fechamento válido, ou -1.
 *
 * Regra do WhatsApp: `*texto*` formata, `* texto *` não. O marcador precisa
 * colar no conteúdo dos dois lados — é isso que faz um asterisco solto no meio
 * da frase continuar sendo um asterisco, em vez de comer o resto da mensagem.
 */
function acharFechamento(
  texto: string,
  inicioConteudo: number,
  marca: string
): number {
  // Conteúdo não pode começar com espaço (nem estar vazio).
  if (ehEspaco(texto[inicioConteudo])) return -1;

  let busca = inicioConteudo;
  for (;;) {
    const fim = texto.indexOf(marca, busca);
    if (fim === -1) return -1;
    if (fim === inicioConteudo) return -1; // vazio: `**`
    // O caractere ANTES do fechamento não pode ser espaço.
    if (!ehEspaco(texto[fim - 1])) return fim;
    busca = fim + marca.length;
  }
}

export function analisarWhatsApp(texto: string, nivel = 0): No[] {
  const nos: No[] = [];
  let buffer = "";
  let i = 0;

  const despejar = () => {
    if (buffer) {
      nos.push({ tipo: "texto", valor: buffer });
      buffer = "";
    }
  };

  while (i < texto.length) {
    let casou = false;

    if (nivel < PROFUNDIDADE_MAX) {
      for (const { marca, estilo } of MARCAS) {
        if (!texto.startsWith(marca, i)) continue;
        const inicio = i + marca.length;
        const fim = acharFechamento(texto, inicio, marca);
        if (fim === -1) continue;

        despejar();
        const conteudo = texto.slice(inicio, fim);
        nos.push({
          tipo: "estilo",
          estilo,
          // Monoespaçado é literal no WhatsApp: um `*` dentro de ``` fica `*`.
          filhos:
            estilo === "mono"
              ? [{ tipo: "texto", valor: conteudo }]
              : analisarWhatsApp(conteudo, nivel + 1),
        });
        i = fim + marca.length;
        casou = true;
        break;
      }
    }

    if (!casou) {
      buffer += texto[i];
      i++;
    }
  }

  despejar();
  return nos;
}

/** Texto sem marcação — para preview do inbox, onde não há como estilizar. */
export function textoLimpo(texto: string): string {
  const partes: string[] = [];
  const anda = (ns: No[]) => {
    for (const n of ns) {
      if (n.tipo === "texto") partes.push(n.valor);
      else anda(n.filhos);
    }
  };
  anda(analisarWhatsApp(texto));
  return partes.join("");
}
