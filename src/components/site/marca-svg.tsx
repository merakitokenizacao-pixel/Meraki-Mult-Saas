import { LETRAS_VORAX } from "@/components/site/letras-vorax";

// A marca em SVG, fiel à do painel (.logo-mark): Cormorant 300, "Vora" em
// creme #f0ece4 e o X em ITÁLICO, ouro #b8955a.
//
// Cada letra é um <path> SEPARADO — é isso que permite desenhar UMA POR VEZ na
// abertura (cada uma com seu animation-delay), como a referência faz. Um <text>
// único desenharia tudo ao mesmo tempo e não pareceria escrita.
//
// `pathLength={1}` normaliza o comprimento de cada contorno para 1, então o
// mesmo stroke-dasharray desenha qualquer letra na mesma velocidade — sem isso,
// o X (contorno longo) demoraria muito mais que o "o".
//
// É a MESMA peça na abertura (grande) e no header (pequena): o framer interpola
// entre os dois pelo `layoutId`, e eles precisam ser idênticos.
const ATRASO_ENTRE_LETRAS = 0.13; // s

export function MarcaSvg({
  desenhando = false,
  claro = false,
  className = "",
}: {
  /** Liga o desenho letra a letra (só na abertura). */
  desenhando?: boolean;
  /** `true` sobre fundo escuro (abertura); `false` no header claro. */
  claro?: boolean;
  className?: string;
}) {
  const corTexto = claro ? "#f0ece4" : "var(--s-ink)";
  const corX = claro ? "#b8955a" : "var(--s-gold)";

  return (
    <svg
      viewBox="0 0 360 96"
      role="img"
      aria-label="VoraX"
      className={className}
      fill="none"
    >
      {LETRAS_VORAX.map((l, i) => {
        const ehX = l.c === "X";
        const cor = ehX ? corX : corTexto;
        return (
          <path
            key={i}
            d={l.d}
            pathLength={1}
            fill={cor}
            stroke={desenhando ? cor : undefined}
            className={desenhando ? "s-marca-traco" : undefined}
            style={
              desenhando
                ? { animationDelay: `${i * ATRASO_ENTRE_LETRAS}s` }
                : undefined
            }
          />
        );
      })}
    </svg>
  );
}
