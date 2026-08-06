"use client";

import { moeda, num, rotuloForma } from "@/lib/financeiro";
import type { Pagamento } from "@/types/db";

// Quebra do recebido por forma. Não é enfeite: taxa de maquininha come margem
// e pix não, então saber a proporção muda decisão de preço.
//
// Cada forma tem um token fixo para a cor ficar estável entre períodos — se
// fosse por índice, "Pix" mudaria de cor quando outra forma passasse na frente.
const TOM: Record<string, string> = {
  pix: "--vx-green",
  dinheiro: "--vx-accent",
  credito: "--vx-blue",
  debito: "--vx-purple",
  link: "--vx-gold",
  cortesia: "--vx-muted",
  outro: "--vx-border2",
};

export function FormasPagamento({ pagamentos }: { pagamentos: Pagamento[] }) {
  if (pagamentos.length === 0) {
    return (
      <div className="neg-vazio">
        Nenhum pagamento registrado no período.
        <br />
        <span className="neg-vazio-dica">
          Os lançamentos entram pela lista de atendimentos, abaixo.
        </span>
      </div>
    );
  }

  const acc = new Map<string, { valor: number; qtd: number }>();
  for (const p of pagamentos) {
    const atual = acc.get(p.forma) ?? { valor: 0, qtd: 0 };
    // Estorno é negativo e deve ABATER a forma em que entrou — por isso soma
    // direta, sem Math.abs.
    atual.valor += num(p.valor);
    atual.qtd += 1;
    acc.set(p.forma, atual);
  }

  const linhas = [...acc.entries()]
    .map(([forma, v]) => ({ forma, ...v }))
    .sort((a, b) => b.valor - a.valor);
  const total = linhas.reduce((s, l) => s + l.valor, 0);

  return (
    <ul className="neg-formas">
      {linhas.map((l) => (
        <li key={l.forma}>
          <span
            className="neg-legenda-ponto"
            style={{ background: `var(${TOM[l.forma] ?? "--vx-border2"})` }}
          />
          <span className="neg-forma-nome">{rotuloForma(l.forma)}</span>
          <span className="neg-forma-pct">
            {total !== 0 ? `${Math.round((l.valor / total) * 100)}%` : "—"}
          </span>
          <span className="neg-forma-valor">{moeda(l.valor)}</span>
        </li>
      ))}
    </ul>
  );
}
