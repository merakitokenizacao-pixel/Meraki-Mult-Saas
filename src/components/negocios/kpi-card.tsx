"use client";

import type { LucideIcon } from "lucide-react";

// Card financeiro na anatomia da referência: rótulo em cima, VALOR como herói,
// quantidade embaixo e o ícone à direita, alinhado com o valor.
//
// Três decisões que o separam do `.metric-card` das outras telas:
//
// 1. DENSIDADE. O atual usa padding 36/32 e número em 46px — ocupa muito para
//    dizer pouco. Aqui cabem cinco lado a lado sem apertar.
// 2. NÚMERO EM SANS TABULAR, não no serif da marca. Cormorant é lindo em
//    título e ruim em coluna de dinheiro: largura variável por dígito faz os
//    valores dançarem entre os cards.
// 3. CONTRASTE VEM DO FUNDO, não de sombra. O atual flutua com shadow-md; este
//    é plano com hairline, e quem separa é o fundo da página.
//
// Selecionável: clicar destaca o card e o gráfico abaixo passa a enfatizar
// aquela série — é o que a referência faz e o que dá função à borda acesa.

/**
 * A cor NÃO identifica o card — identifica a direção do número.
 *
 * Antes eram cinco matizes (dourado, verde, vermelho, azul, roxo), um por
 * card: cinco cores fortes lado a lado viram enfeite, e "azul" não significa
 * nada sobre "total criado". Agora o padrão é neutro e só sobra semântica onde
 * ela é real — o que entrou (`sobe`) e o que se perdeu (`desce`). O dourado da
 * marca fica reservado para o estado SELECIONADO, que é o único destaque com
 * função nesta tela.
 */
export type TomKpi = "neutro" | "sobe" | "desce";

export function KpiCard({
  rotulo,
  valor,
  apoio,
  icone: Icone,
  tom = "neutro",
  ativo = false,
  onSelecionar,
  dica,
}: {
  rotulo: string;
  valor: string;
  apoio: string;
  icone: LucideIcon;
  tom?: TomKpi;
  ativo?: boolean;
  onSelecionar?: () => void;
  /** De onde sai o número. Vira o tooltip do (i) ao lado do rótulo. */
  dica?: string;
}) {
  const conteudo = (
    <>
      <span className="neg-card-rotulo">
        {rotulo}
        {dica && (
          // A ressalva mora aqui, não numa tarja na tela. `data-dica` desenha
          // o balão no hover (o `title` nativo demora ~1s); o `title` fica
          // junto porque o card inteiro é um <button> — pôr um segundo
          // elemento focável dentro dele quebraria a ordem de tabulação.
          <span className="neg-dica" title={dica} data-dica={dica}>
            i
          </span>
        )}
      </span>
      <div className="neg-card-linha">
        <div className="neg-card-numeros">
          <div className="neg-card-valor">{valor}</div>
          <div className="neg-card-apoio">{apoio}</div>
        </div>
        <span className="neg-card-icone" aria-hidden="true">
          <Icone size={16} strokeWidth={2} />
        </span>
      </div>
    </>
  );

  if (!onSelecionar) {
    return <div className={`neg-card neg-tom-${tom}`}>{conteudo}</div>;
  }

  return (
    <button
      type="button"
      onClick={onSelecionar}
      aria-pressed={ativo}
      className={`neg-card neg-card-btn neg-tom-${tom}${ativo ? " ativo" : ""}`}
    >
      {conteudo}
    </button>
  );
}
