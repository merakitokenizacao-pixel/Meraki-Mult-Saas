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
  const [erro, setErro] = useState(false);
  const [bg, fg] = getAvatarColors(nome);
  const hasFoto = fotoUrl != null && !INVALID_FOTO.has(fotoUrl);

  if (hasFoto && !erro) {
    return (
      <img
        src={fotoUrl as string}
        alt={nome ?? ""}
        onError={() => setErro(true)}
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
        background: `${bg}22`,
        color: fg,
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
