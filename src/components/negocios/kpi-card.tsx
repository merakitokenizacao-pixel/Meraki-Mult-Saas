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
 * A cor do ícone.
 *
 * Três cinzas e dois coloridos criavam uma hierarquia que ninguém quis dizer:
 * parecia que dois cards importavam e três estavam desabilitados. E o cinza
 * era `--vx-muted`, claro demais para um ícone — lê como desativado, não como
 * neutro.
 *
 * Agora cada card tem a sua, e "criado" é neutro DE PROPÓSITO (é a linha de
 * base, não é bom nem ruim) — mas em `--vx-text2`, que lê como escolha.
 *
 * Nenhum é dourado: `--vx-accent` é a borda do card selecionado nesta mesma
 * fileira. Repetido num ícone, ele deixaria de significar "selecionado".
 */
export type TomKpi = "base" | "sobe" | "desce" | "aberto" | "recuperado";

export function KpiCard({
  rotulo,
  valor,
  apoio,
  icone: Icone,
  tom = "base",
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
  /** De onde sai o número. Vira o tooltip do (i) no canto do card. */
  dica?: string;
}) {
  const conteudo = (
    <>
      {/* O (i) sai da LINHA do rótulo e vai para o canto do card. Colado no
          texto ele empurrava a largura da linha, e num rótulo de duas palavras
          isso é a diferença entre caber e quebrar. */}
      {dica && (
        // `data-dica` desenha o balão no hover (o `title` nativo demora ~1s);
        // o `title` fica junto porque o card inteiro é um <button> — pôr um
        // segundo elemento focável dentro dele quebraria a ordem de tabulação.
        <span className="neg-dica" title={dica} data-dica={dica}>
          i
        </span>
      )}
      <span className="neg-card-rotulo">{rotulo}</span>
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
