"use client";

import { useState } from "react";
import { getAvatarColors, getInitials } from "@/lib/format";

// Replica renderAvatar do legacy: foto (com fallback para iniciais) ou iniciais
// sobre cor determinística da paleta. Fundo = cor + "22" (alpha hex).
const INVALID_FOTO = new Set(["", "=", "null", "undefined"]);

export function Avatar({
  nome,
  fotoUrl,
  size = 36,
  fontSize = 11,
  className = "",
  style,
}: {
  nome?: string | null;
  fotoUrl?: string | null;
  size?: number;
  fontSize?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  // Guarda a URL que falhou, não um booleano: as fotos do WhatsApp
  // (pps.whatsapp.net) EXPIRAM em poucos dias, então onError é rotina. Com um
  // booleano, o primeiro link vencido envenenava a instância — e onde o Avatar
  // é reaproveitado (cabeçalho do chat, painel de detalhes) todo cliente
  // seguinte caía nas iniciais, mesmo com foto válida.
  const [urlComErro, setUrlComErro] = useState<string | null>(null);
  const token = getAvatarColors(nome);
  const hasFoto = fotoUrl != null && !INVALID_FOTO.has(fotoUrl);

  if (hasFoto && urlComErro !== fotoUrl) {
    return (
      <img
        src={fotoUrl as string}
        alt={nome ?? ""}
        onError={() => setUrlComErro(fotoUrl as string)}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  return (
    <div
      className={`avatar ${className}`}
      style={{
        // Fundo derivado da própria cor; texto na cor CHEIA. Antes o texto era
        // um tom clarinho separado, e ele sumia no fundo.
        background: `color-mix(in srgb, var(${token}) 12%, transparent)`,
        color: `var(${token})`,
        width: size,
        height: size,
        fontSize,
        flexShrink: 0,
        ...style,
      }}
    >
      {getInitials(nome)}
    </div>
  );
}
