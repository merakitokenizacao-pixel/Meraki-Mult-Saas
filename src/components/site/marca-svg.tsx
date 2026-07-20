// A marca em SVG, fiel à do painel (.logo-mark em globals.css):
//   Cormorant 300 · "Vora" em creme #f0ece4 · o X em ITÁLICO, ouro #b8955a
// O itálico do X é a assinatura da marca — sem ele não é a nossa logo.
//
// É a MESMA peça usada na abertura (grande, no centro) e no header (pequena):
// é isso que permite o logo "voar" de um lugar pro outro, porque o framer
// interpola entre dois nós com o mesmo `layoutId` e eles precisam ser
// visualmente idênticos.
//
// Usa <text> em vez de paths desenhados à mão porque a marca é tipográfica.
// O traço da abertura é feito com stroke-dasharray sobre o texto — funciona
// em SVG e evita converter a fonte em curvas.
export function MarcaSvg({
  desenhando = false,
  claro = false,
  className = "",
}: {
  /** Liga o desenho do traço (só na abertura). */
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
      style={{ overflow: "visible" }}
    >
      <text
        x="180"
        y="70"
        textAnchor="middle"
        fontFamily="var(--font-cormorant), Georgia, serif"
        fontSize="76"
        fontWeight="300"
        letterSpacing="1.5"
        className={desenhando ? "s-marca-traco" : undefined}
        fill={corTexto}
      >
        Vora
        <tspan fill={corX} fontStyle="italic">
          X
        </tspan>
      </text>
    </svg>
  );
}
