"use client";

import type { LucideIcon } from "lucide-react";

// ── EXPERIMENTO DE LAYOUT ────────────────────────────────────────────────────
// Card novo, isolado de propósito na aba Negócios. Se aprovar, migra para o
// resto do sistema; se não, some sem tocar em nada.
//
// Três decisões que o separam do `.metric-card` de hoje:
//
// 1. DENSIDADE. O atual usa padding 2.25rem e número em 46px — ocupa muito
//    para dizer pouco. Aqui: padding 18/20, número em 30px. Cabem quatro
//    lado a lado sem esticar a tela.
// 2. NÚMERO EM SANS TABULAR, não no serif da marca. Cormorant é lindo em
//    título e péssimo em coluna de número: largura variável faz os valores
//    dançarem entre os cards. `tabular-nums` alinha.
// 3. CONTRASTE VEM DO FUNDO, NÃO DE SOMBRA. O atual flutua com shadow-md; este
//    é plano com hairline, e quem separa é o fundo da página. Foi o que o
//    dono apontou na referência ("o fundo tem um contraste perfeito").
//
// O ícone ganha um chip com o fundo tingido da própria cor — é o "destaque"
// que ele elogiou, e sai de graça porque cada cor funcional já tem par
// `--vx-X` / `--vx-X-bg` nos três temas.

export type TomKpi = "accent" | "green" | "blue" | "purple";

export function KpiCard({
  rotulo,
  valor,
  apoio,
  icone: Icone,
  tom = "accent",
  semFonte = false,
}: {
  rotulo: string;
  valor: string;
  apoio: string;
  icone: LucideIcon;
  tom?: TomKpi;
  /** Marca o card cuja origem de dado ainda não existe — em vez de exibir
   *  um zero que se lê como informação verdadeira. */
  semFonte?: boolean;
}) {
  return (
    <div className={`neg-card neg-tom-${tom}`}>
      <div className="neg-card-topo">
        <span className="neg-card-rotulo">{rotulo}</span>
        <span className="neg-card-icone">
          <Icone size={17} strokeWidth={1.75} />
        </span>
      </div>
      <div className={`neg-card-valor${semFonte ? " vazio" : ""}`}>{valor}</div>
      <div className="neg-card-apoio">
        {semFonte && <span className="neg-chip-fonte">sem fonte</span>}
        {apoio}
      </div>
    </div>
  );
}
