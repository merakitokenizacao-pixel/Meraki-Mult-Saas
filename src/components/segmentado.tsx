"use client";

import { useRef } from "react";

// Controle segmentado — o mesmo desenho das abas "Negócios / Multiatendimento"
// do topo da tela, extraído para um lugar só.
//
// Substitui os `<select>` nativos dos painéis. Escolha entre DUAS opções é
// toggle, não dropdown: o select custava dois cliques, escondia metade da
// informação e — o pior — abria a lista com o azul do sistema operacional, a
// única coisa da tela que não seguia o tema, porque `<option>` não é
// estilizável.
//
// A extração é o que garante que os dois nunca divirjam: as abas do topo
// passaram a usar este componente também.

export interface OpcaoSegmento<T extends string> {
  valor: T;
  rotulo: string;
}

export function Segmentado<T extends string>({
  opcoes,
  valor,
  onChange,
  rotuloAcessivel,
  className = "",
}: {
  opcoes: ReadonlyArray<OpcaoSegmento<T>>;
  valor: T;
  onChange: (v: T) => void;
  /** O que o grupo representa, para quem usa leitor de tela. */
  rotuloAcessivel: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Seta anda entre as opções e JÁ SELECIONA, que é o comportamento esperado de
  // um radiogroup — não existe "focar sem escolher" aqui, são duas opções e a
  // troca é instantânea.
  function aoTeclar(e: React.KeyboardEvent) {
    const dir =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!dir) return;
    e.preventDefault();
    const i = opcoes.findIndex((o) => o.valor === valor);
    // Circular: da última volta para a primeira.
    const prox = opcoes[(i + dir + opcoes.length) % opcoes.length];
    onChange(prox.valor);
    // Leva o foco junto, senão a seta seguinte partiria do botão antigo.
    const alvo = ref.current?.querySelector<HTMLButtonElement>(
      `[data-valor="${prox.valor}"]`
    );
    alvo?.focus();
  }

  return (
    <div
      ref={ref}
      className={`seg${className ? ` ${className}` : ""}`}
      role="radiogroup"
      aria-label={rotuloAcessivel}
      onKeyDown={aoTeclar}
    >
      {opcoes.map((o) => {
        const ativa = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativa}
            data-valor={o.valor}
            // Só a opção ativa entra na ordem de tabulação: o grupo inteiro é
            // UMA parada de Tab, e as setas navegam dentro dele.
            tabIndex={ativa ? 0 : -1}
            className={`seg-item${ativa ? " ativa" : ""}`}
            onClick={() => onChange(o.valor)}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/** As duas opções que se repetem nos quatro painéis da Visão geral. */
export const VALOR_QTD = [
  { valor: "valor", rotulo: "Valor" },
  { valor: "qtd", rotulo: "Quantidade" },
] as const;
