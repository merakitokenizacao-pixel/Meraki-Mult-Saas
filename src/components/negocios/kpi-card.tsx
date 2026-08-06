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

export type TomKpi = "accent" | "green" | "red" | "blue" | "purple";

export function KpiCard({
  rotulo,
  valor,
  apoio,
  icone: Icone,
  tom = "accent",
  ativo = false,
  onSelecionar,
  dica,
  selo,
}: {
  rotulo: string;
  valor: string;
  apoio: string;
  icone: LucideIcon;
  tom?: TomKpi;
  ativo?: boolean;
  onSelecionar?: () => void;
  /** Explica de onde sai o número — vira o `title` do rótulo. */
  dica?: string;
  /** Ressalva que precisa ser VISÍVEL, não só no hover: um card que se comporta
   *  diferente dos outros (não segue o período, ou é número simulado) tem que
   *  dizer isso na cara, senão é lido como igual aos vizinhos. */
  selo?: string;
}) {
  const conteudo = (
    <>
      <span className="neg-card-rotulo" title={dica}>
        {rotulo}
        {selo && <span className="neg-selo">{selo}</span>}
      </span>
      <div className="neg-card-linha">
        <div className="neg-card-numeros">
          <div className="neg-card-valor">{valor}</div>
          <div className="neg-card-apoio">{apoio}</div>
        </div>
        <span className="neg-card-icone" aria-hidden="true">
          <Icone size={22} strokeWidth={2} />
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
