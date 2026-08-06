"use client";

import { moeda, num } from "@/lib/financeiro";
import type { PacoteSaldo } from "@/types/db";

// O CONTRAPESO do Bloco 1, não curiosidade.
//
// A receita de pacote é reconhecida INTEIRA na venda: o Combo Laser de 40
// sessões vendido em agosto entra 100% em agosto, e os meses de entrega
// aparecem vazios no "Recebido". Sem este passivo à vista, o mês seguinte
// parece ruim quando na verdade a clínica está entregando o que já vendeu.
export function PacotesSaldo({ pacotes }: { pacotes: PacoteSaldo[] }) {
  if (pacotes.length === 0) {
    return (
      <div className="neg-vazio">
        Nenhuma sessão de pacote pendente de entrega.
      </div>
    );
  }

  const sessoes = pacotes.reduce((s, p) => s + (p.sessoes_restantes ?? 0), 0);

  return (
    <>
      <div className="neg-passivo-topo">
        <span className="neg-passivo-num">{sessoes}</span>
        <span className="neg-passivo-txt">
          {sessoes === 1 ? "sessão já paga" : "sessões já pagas"} a entregar,
          em {pacotes.length} {pacotes.length === 1 ? "venda" : "vendas"}
        </span>
      </div>
      <ul className="neg-pacotes">
        {pacotes.slice(0, 8).map((p) => {
          const total = p.sessoes_total ?? 0;
          const usadas = p.sessoes_usadas ?? 0;
          const pct = total > 0 ? (usadas / total) * 100 : 0;
          return (
            <li key={`${p.venda_id}-${p.item}`} className="neg-pacote">
              <div className="neg-linha-topo">
                <span className="neg-linha-nome" title={p.cliente ?? ""}>
                  {p.cliente || "—"}
                  <span className="neg-pacote-item">
                    {" · "}
                    {p.item || p.pacote || "pacote"}
                  </span>
                </span>
                <span className="neg-linha-qtd">
                  {usadas}/{total}
                  {p.valor_acordado ? (
                    <span className="neg-linha-pct">
                      {" · "}
                      {moeda(num(p.valor_acordado))}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="neg-barra-trilho">
                <div
                  className="neg-barra entregue"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {pacotes.length > 8 && (
        <div className="neg-mais">e mais {pacotes.length - 8}…</div>
      )}
    </>
  );
}
