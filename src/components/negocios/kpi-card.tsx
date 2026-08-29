"use client";

import { Info, type LucideIcon } from "lucide-react";

// Card financeiro: rótulo em cima, valor no meio, subtexto embaixo, ícone
// alinhado com a BASE do valor.
//
// Selecionável — e a seleção é NAVEGAÇÃO, não enfeite: o card diz o que você
// está olhando e o gráfico abaixo mostra aquela série, na mesma cor.

/**
 * Cada KPI tem UMA cor, e ela aparece em três lugares do mesmo card: no ícone
 * (sempre), na borda e na faixa de 2px do topo (só quando selecionado).
 *
 * ⚠️ Já foi de três formas antes desta, e as três falhavam pelo mesmo motivo.
 * Cinco matizes decorativos viraram enfeite. Direção (sobe/desce/neutro)
 * deixou três cards cinzas. Estado por card resolveu a semântica mas manteve a
 * borda de seleção SEMPRE no acento — então clicar em qualquer um dos cinco
 * dava a mesma borda roxa, e a cor só existia num ícone de 16px, que some.
 *
 * Agora a seleção assume a cor do próprio card. Cinza não serve como borda de
 * seleção: não marca nada. Por isso "Total criado" saiu de tinta-média e
 * ganhou o acento — ele é a entrada do funil, e o roxo é a marca.
 */
export type TomKpi =
  | "acento"
  | "resolvido"
  | "erro"
  | "agendado"
  | "atendendo"
  | "neutro";

/**
 * O NOME do token de cada tom — nunca o valor.
 *
 * Existe porque o gráfico precisa da cor em JS (canvas não herda CSS, a cor é
 * lida com `getComputedStyle`), enquanto o card precisa dela em CSS. Uma
 * tabela só impede que as duas divirjam: mudar a cor de um KPI passa a ser
 * mudar uma linha aqui e uma no `globals.css`, com o mesmo nome dos dois lados.
 */
export const TOKEN_DO_TOM: Record<TomKpi, string> = {
  acento: "--mk-acento",
  resolvido: "--mk-st-resolvido",
  erro: "--mk-st-erro",
  agendado: "--mk-st-agendado",
  atendendo: "--mk-st-atendendo",
  neutro: "--mk-tinta-media",
};

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
  /**
   * A regra da métrica, em uma frase. Vira o `ⓘ` ao lado do rótulo.
   *
   * ⚠️ NÃO É PARA TODO CARD. Ajuda em tudo é ajuda em nada: quando os cinco
   * tinham `ⓘ`, o ícone virava parte do desenho e ninguém o lia. Fica só onde
   * a métrica não se explica sozinha — "Total ganhos" se explica, "Total em
   * aberto" não (o que conta como aberto: pendente, confirmado, os dois?).
   */
  dica?: string;
}) {
  const conteudo = (
    <>
      <span className="neg-card-rotulo">
        {rotulo}
        {dica && (
          // `data-dica` desenha o balão no hover (o `title` nativo demora
          // ~1s); o `title` fica junto porque o card inteiro é um <button> —
          // pôr um segundo elemento focável dentro dele quebraria a ordem de
          // tabulação, e quem navega por teclado perderia o card.
          <span className="neg-dica" title={dica} data-dica={dica}>
            <Info size={12} strokeWidth={1.8} aria-hidden="true" />
          </span>
        )}
      </span>
      <div className="neg-card-valor">{valor}</div>
      {/* O ícone fecha a ÚLTIMA LINHA, ao lado do subtexto. Antes ele ficava
          na linha do valor, e as três linhas do card tinham começo mas só duas
          tinham fim — um elemento pendurado fora do fluxo. Aqui cada linha tem
          início e término, que é o que faz o card parecer resolvido. */}
      <div className="neg-card-linha">
        <div className="neg-card-apoio">{apoio}</div>
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
