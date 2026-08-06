"use client";

import { moeda } from "@/lib/financeiro";

// Ranking em barras, não rosca. A pergunta aqui é ordem e distância entre os
// primeiros — barra responde as duas de relance; rosca obriga a comparar
// ângulos e a caçar a legenda.
export function RankingValor({
  linhas,
  vazio = "Nada no período.",
  sufixo = "×",
}: {
  linhas: Array<{ nome: string; valor: number; qtd: number }>;
  vazio?: string;
  sufixo?: string;
}) {
  if (linhas.length === 0) return <div className="neg-vazio">{vazio}</div>;

  // Proporcional ao PRIMEIRO, não ao total: com muitos itens todas as barras
  // encolheriam e a comparação sumiria. Guarda contra zero (tudo em pacote,
  // por exemplo, vale R$ 0 e dividiria por zero).
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
                <span className="neg-linha-pct">
                  {" "}
                  · {l.qtd}
                  {sufixo}
                </span>
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
