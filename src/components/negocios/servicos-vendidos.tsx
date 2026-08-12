"use client";

import { moeda, type LinhaServico } from "@/lib/financeiro";
import type { Modo } from "@/components/negocios/dados-diarios";

// Ranking em barras, não rosca. Para "mais vendidos" a pergunta é ordem e
// distância entre os primeiros — barra responde as duas de relance; rosca
// obriga a comparar ângulos e a caçar a legenda.
export function ServicosVendidos({
  linhas,
  modo = "valor",
}: {
  linhas: LinhaServico[];
  modo?: Modo;
}) {
  if (linhas.length === 0) {
    return <div className="neg-vazio">Nenhum procedimento realizado no período.</div>;
  }

  // O ranking chega ordenado por VALOR. Em "quantidade" a ordem tem que mudar
  // junto, senão a 1ª barra fica menor que a 2ª e o número da posição mente.
  const ordenadas =
    modo === "valor" ? linhas : [...linhas].sort((a, b) => b.qtd - a.qtd);
  const base = (l: LinhaServico) => (modo === "valor" ? l.valor : l.qtd);

  // Proporcional ao PRIMEIRO, não ao total: com muitos serviços todas as barras
  // ficariam curtas e a comparação sumiria.
  const maior = base(ordenadas[0]) || 1;

  return (
    <div className="neg-ranking">
      {ordenadas.map((l, i) => (
        <div key={l.nome} className="neg-linha">
          <span className="neg-pos">{i + 1}</span>
          <div className="neg-linha-corpo">
            <div className="neg-linha-topo">
              <span className="neg-linha-nome" title={l.nome}>
                {l.nome}
              </span>
              <span className="neg-linha-qtd">
                {modo === "valor" ? moeda(l.valor) : `${l.qtd}×`}
                <span className="neg-linha-pct">
                  {modo === "valor" ? ` · ${l.qtd}×` : ` · ${moeda(l.valor)}`}
                </span>
              </span>
            </div>
            <div className="neg-barra-trilho">
              <div
                className="neg-barra"
                style={{ width: `${Math.max(4, (base(l) / maior) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
