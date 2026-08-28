"use client";

import { useRef } from "react";

// Controle segmentado — escolha entre poucas opções mutuamente exclusivas.
//
// POR QUE ELE EXISTE. Os painéis da Visão geral usavam `<select>` nativo com
// DUAS opções (Valor / Quantidade). Duas coisas erradas nisso:
//
// 1. Duas opções é toggle, não dropdown. Um dropdown para escolha binária
//    custa dois cliques e esconde metade da informação — quem olha não sabe
//    que existe "Quantidade" sem abrir.
// 2. `<select>` nativo abre a lista com o widget do SISTEMA OPERACIONAL, que é
//    claro, e não há CSS que mude isso. No painel preto era a única peça que
//    não seguia o tema.
//
// ACESSIBILIDADE. É um `radiogroup`, não um `tablist`: as abas Negócios /
// Multiatendimento trocam o painel inteiro (tab), estas opções trocam a BASE
// do mesmo painel (radio). O foco é roving — só a opção marcada é tabulável, e
// as setas andam entre elas. É o que a APG manda para grupo de rádio: um Tab
// entra no grupo, não em cada opção.

export interface OpcaoSegmentada<T extends string> {
  valor: T;
  rotulo: string;
}

export function Segmentado<T extends string>({
  valor,
  onChange,
  opcoes,
  rotulo,
}: {
  valor: T;
  onChange: (v: T) => void;
  opcoes: ReadonlyArray<OpcaoSegmentada<T>>;
  /** Descreve o grupo para leitor de tela ("Base do gráfico"). */
  rotulo: string;
}) {
  const trilho = useRef<HTMLDivElement>(null);

  function andar(passo: number, de: number) {
    // Circular: da última a seta segue para a primeira. Parar na ponta faria
    // a tecla não responder, que se lê como controle travado.
    const i = (de + passo + opcoes.length) % opcoes.length;
    onChange(opcoes[i].valor);
    // O DOM ainda não re-renderizou; mover o foco pelo índice é o que mantém
    // o teclado no lugar certo.
    const botoes = trilho.current?.querySelectorAll<HTMLButtonElement>("[role=radio]");
    botoes?.[i]?.focus();
  }

  function aoTeclar(e: React.KeyboardEvent, i: number) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        andar(1, i);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        andar(-1, i);
        break;
      case "Home":
        e.preventDefault();
        andar(-i, i);
        break;
      case "End":
        e.preventDefault();
        andar(opcoes.length - 1 - i, i);
        break;
    }
  }

  return (
    <div className="seg" role="radiogroup" aria-label={rotulo} ref={trilho}>
      {opcoes.map((o, i) => {
        const marcada = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={marcada}
            tabIndex={marcada ? 0 : -1}
            onClick={() => onChange(o.valor)}
            onKeyDown={(e) => aoTeclar(e, i)}
            className={`seg-opcao${marcada ? " marcada" : ""}`}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/** Os painéis da Visão geral usam todos exatamente estas duas opções. */
export const OPCOES_BASE = [
  { valor: "valor", rotulo: "Valor" },
  { valor: "qtd", rotulo: "Quantidade" },
] as const;
