"use client";

import { moeda, type LinhaServico } from "@/lib/financeiro";

// Ranking em barras, não rosca. Para "mais vendidos" a pergunta é ordem e
// distância entre os primeiros — barra responde as duas de relance; rosca
// obriga a comparar ângulos e a caçar a legenda.
export function ServicosVendidos({ linhas }: { linhas: LinhaServico[] }) {
  if (linhas.length === 0) {
    return <div className="neg-vazio">Nenhum procedimento realizado no período.</div>;
  }

  // Proporcional ao PRIMEIRO, não ao total: com muitos serviços todas as barras
  // ficariam curtas e a comparação sumiria.
  const maior = linhas[0].valor || 1;

  return (
    <div className="neg-ranking">
      {linhas.map((l, i) => (
        <div key={l.nome} className="neg-linha">
          <span className="neg-pos">{i + 1}</span>
          <div className="neg-linha-corpo">
            <div className="neg-linha-topo">
              <span className="neg-linha-nome" title={l.nome}>
                {l.nome}
              </span>
              <span className="neg-linha-qtd">
                {moeda(l.valor)}
                <span className="neg-linha-pct"> · {l.qtd}×</span>
              </span>
            </div>
            <div className="neg-barra-trilho">
              <div
                className="neg-barra"
                style={{ width: `${Math.max(4, (l.valor / maior) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
