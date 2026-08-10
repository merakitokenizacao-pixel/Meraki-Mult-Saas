"use client";

import { useMemo } from "react";
import { analisarWhatsApp, type No } from "@/lib/formato-whatsapp";

// Renderiza a marcação do WhatsApp (*negrito*, _itálico_, ~riscado~, ```mono```).
//
// Cria elementos React a partir da árvore — nunca `dangerouslySetInnerHTML`.
// A mensagem vem da cliente ou do agente, e montar HTML com esse texto seria
// injeção pronta. Assim o escape é do próprio React.

function render(nos: No[], chave = ""): React.ReactNode[] {
  return nos.map((n, i) => {
    const k = `${chave}${i}`;
    if (n.tipo === "texto") return <span key={k}>{n.valor}</span>;
    const filhos = render(n.filhos, k + "-");
    switch (n.estilo) {
      case "negrito":
        return <strong key={k}>{filhos}</strong>;
      case "italico":
        return <em key={k}>{filhos}</em>;
      case "riscado":
        return (
          <span key={k} className="line-through">
            {filhos}
          </span>
        );
      case "mono":
        return (
          <code key={k} className="rounded bg-black/15 px-1 font-mono text-[0.92em]">
            {filhos}
          </code>
        );
    }
  });
}

export function TextoWhatsApp({ texto }: { texto: string }) {
  // A árvore só muda quando o texto muda — evita re-parsear a conversa
  // inteira a cada render do chat.
  const nos = useMemo(() => analisarWhatsApp(texto), [texto]);
  return <>{render(nos)}</>;
}
