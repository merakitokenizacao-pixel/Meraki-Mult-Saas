import { LETRAS_VORAX } from "@/components/site/letras-vorax";

// A marca em SVG, fiel à do painel (.logo-mark): Cormorant 300, com o X em
// ITÁLICO e dourado.
//
// Cada letra é um <path> SEPARADO — é isso que permite escrever UMA POR VEZ na
// abertura (cada uma com seu animation-delay). Um <text> único desenharia tudo
// ao mesmo tempo e não pareceria escrita.
//
// `pathLength={1}` normaliza o contorno de cada letra para 1, então o mesmo
// stroke-dasharray desenha todas na mesma velocidade — sem isso, o X (contorno
// longo) arrastaria muito mais que o "o".
//
// As cores são as MESMAS na abertura e no header: agora que a abertura é clara,
// o logo não muda de cor durante o voo — é literalmente a mesma peça do
// primeiro ao último quadro, que é o que faz o `layoutId` funcionar sem salto.
const ATRASO_ENTRE_LETRAS = 0.13; // s

export function MarcaSvg({
  desenhando = false,
  className = "",
}: {
  /** Liga a escrita letra a letra (só na abertura). */
  desenhando?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 360 96"
      role="img"
      aria-label="VoraX"
      className={className}
      fill="none"
    >
      {LETRAS_VORAX.map((l, i) => {
        const cor = l.c === "X" ? "var(--s-gold)" : "var(--s-ink)";
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
