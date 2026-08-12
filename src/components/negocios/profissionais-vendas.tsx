"use client";

import { getInitials } from "@/lib/format";
import { moeda } from "@/lib/financeiro";
import { qtdTexto, type FatiaProfissional } from "@/lib/atribuicao";

// Mesma fonte da rosca, leitura diferente: aqui interessa o valor por pessoa e
// o ticket médio, não a fatia do bolo.
export function ProfissionaisVendas({ fatias }: { fatias: FatiaProfissional[] }) {
  if (fatias.length === 0) {
    return <div className="neg-vazio">Nenhum atendimento realizado no período.</div>;
  }

  return (
    <ul className="neg-pessoas">
      {fatias.map((f, i) => (
        <li key={f.nome} className="neg-pessoa">
          <span className="neg-pos">{i + 1}</span>
          {/* O fundo é a cor do token diluída; o texto é a cor cheia. Antes o
              fundo era `${hex}22` com o texto no mesmo hex da paleta CLARA — no
              tema Escuro isso dava 2:1 de contraste, ilegível. `color-mix` faz a
              diluição em cima do token, então cada tema resolve a sua. */}
          <span
            className="neg-pessoa-avatar"
            style={{
              background: `color-mix(in srgb, var(${f.token}) 18%, transparent)`,
              color: `var(${f.token})`,
            }}
          >
            {getInitials(f.nome)}
          </span>
          <div className="neg-pessoa-corpo">
            <div className="neg-pessoa-nome">{f.nome}</div>
            <div className="neg-pessoa-sub">
              {qtdTexto(f.qtd)} atendimento{qtdTexto(f.qtd) === "1" ? "" : "s"} · ticket{" "}
              {moeda(f.qtd > 0 ? f.valor / f.qtd : 0)}
            </div>
          </div>
          <span className="neg-pessoa-valor">{moeda(f.valor)}</span>
        </li>
      ))}
    </ul>
  );
}
