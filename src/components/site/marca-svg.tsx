// A marca em SVG. É a MESMA peça usada na abertura (grande, no centro) e no
// header (pequena) — é isso que permite o logo "voar" de um lugar pro outro:
// o framer anima entre dois nós que compartilham o mesmo `layoutId`, e eles
// precisam ser visualmente idênticos, senão o salto aparece.
//
// Usa <text> em vez de paths desenhados à mão porque a marca é tipográfica
// (Cormorant). O traço da abertura é feito com stroke-dasharray sobre o texto
// — funciona em SVG e evita ter que converter a fonte em curvas.
export function MarcaSvg({
  desenhando = false,
  className = "",
}: {
  desenhando?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 360 96"
      role="img"
      aria-label="VoraX"
      className={className}
      // O dasharray precisa ser maior que o contorno da palavra; 1400 cobre
      // com folga no viewBox acima.
      style={{ overflow: "visible" }}
    >
      <text
        x="180"
        y="70"
        textAnchor="middle"
        fontFamily="var(--font-cormorant), Georgia, serif"
        fontSize="76"
        fontWeight="300"
        letterSpacing="1"
        className={desenhando ? "s-marca-traco" : undefined}
        fill={desenhando ? "#f7f4ee" : "currentColor"}
      >
        Vora
        <tspan fill={desenhando ? "#d9bd91" : "var(--s-gold)"}>X</tspan>
      </text>
    </svg>
  );
}
