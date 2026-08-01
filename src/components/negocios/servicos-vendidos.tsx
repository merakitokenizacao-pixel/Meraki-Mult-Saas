"use client";

import { limparServico } from "@/lib/format";
import type { Agendamento } from "@/types/db";

// Ranking em barras, não rosca. Para "mais vendidos" a pergunta é ordem e
// distância entre os primeiros — barra responde as duas de relance; rosca
// obriga a comparar ângulos e a caçar a legenda.
//
// Conta só `realizado`: vendido é o que aconteceu. Marcado ainda pode cair.

const TETO = 6;

export function ServicosVendidos({
  agendamentos,
}: {
  agendamentos: Agendamento[];
}) {
  const realizados = agendamentos.filter((a) => a.status === "realizado");

  const contagem = new Map<string, number>();
  for (const a of realizados) {
    const nome = limparServico(a.servico);
    if (nome === "—") continue;
    contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
  }

  const linhas = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TETO);
  const maior = linhas[0]?.[1] ?? 1;
  const total = realizados.length;

  if (linhas.length === 0) {
    return (
      <div className="neg-vazio">Nenhum procedimento realizado no período.</div>
    );
  }

  return (
    <div className="neg-ranking">
      {linhas.map(([nome, qtd], i) => (
        <div key={nome} className="neg-linha">
          <span className="neg-pos">{i + 1}</span>
          <div className="neg-linha-corpo">
            <div className="neg-linha-topo">
              <span className="neg-linha-nome">{nome}</span>
              <span className="neg-linha-qtd">
                {qtd}
                <span className="neg-linha-pct">
                  {total > 0 ? ` · ${Math.round((qtd / total) * 100)}%` : ""}
                </span>
              </span>
            </div>
            <div className="neg-barra-trilho">
              {/* Proporcional ao PRIMEIRO, não ao total: com muitos serviços
                  todas as barras ficariam curtas e a comparação sumiria. */}
              <div
                className="neg-barra"
                style={{ width: `${Math.max(4, (qtd / maior) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
