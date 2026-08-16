"use client";

import { useEffect, useRef, useState } from "react";

// Uma frase sozinha na tela, sem cartão, sem ícone, sem imagem.
//
// Existe para quebrar a sequência demo-demo-demo: quatro seções seguidas com o
// mesmo formato — texto à esquerda, produto à direita — fazem cada uma parecer
// genérica, mesmo quando o conteúdo é bom. O silêncio entre elas é o que
// devolve peso à seguinte.
//
// Centralizada e ocupando a tela sozinha, de propósito: é a única âncora
// visual da página que não fica à direita.

export function FraseMonumento({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [entrou, setEntrou] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEntrou(true);
      return;
    }
    // Dispara UMA vez e desconecta. Nada preso ao evento de scroll — era isso
    // que fazia a página engasgar.
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setEntrou(true);
        obs.disconnect();
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="s-monumento">
      <p className={`s-monumento-frase${entrou ? " entrou" : ""}`}>{children}</p>
    </section>
  );
}
