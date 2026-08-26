// A marca em SVG, fiel à do painel (.logo-mark): Cormorant 300, com a última
// letra dourada.
//
// ⚠️ MUDOU NA VIRADA PARA MERAKI, e vale saber o porquê antes de mexer.
//
// Antes, cada letra era um <path> com o contorno CONGELADO da marca antiga —
// gerado uma vez com opentype.js a partir dos TTF do Google Fonts. Isso dava
// duas coisas: escrita letra a letra (cada <path> com seu animation-delay) e
// independência da fonte ter carregado.
//
// Só que aqueles contornos desenhavam, letra por letra, o nome ANTIGO — não
// dava para reaproveitá-los. Regerar para "Meraki" exige os .ttf e o
// opentype.js, que não estão aqui; e desenhar um letreiro à mão seria decidir
// a identidade do Meraki de passagem, que é justamente o que ficou para
// depois (ver CLAUDE.md, "Regras visuais").
//
// Então a marca virou <text> na mesma fonte, com um <tspan> por letra. O que
// se manteve: o desenho, as cores, a escrita letra a letra e o layoutId da
// abertura. O que se perdeu: o traço tem comprimento fixo em vez de
// normalizado, então as letras não desenham exatamente na mesma velocidade.
// O ESTADO FINAL é o mesmo — preenchido —, então nada quebra se o tempo sair
// torto num navegador. Para recuperar o traço perfeito, gere os contornos da
// palavra nova e volte ao <path>.

const ATRASO_ENTRE_LETRAS = 0.13; // s

/** A marca, letra a letra. A última é a dourada — o mesmo destaque de antes. */
const LETRAS = ["M", "e", "r", "a", "k", "i"];

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
      aria-label="Meraki"
      className={className}
      fill="none"
    >
      {/* viewBox, tamanho e linha de base são os mesmos de antes (76 / y=70),
          para a marca ocupar a mesma caixa nos dois lugares onde aparece. */}
      <text
        x="180"
        y="70"
        textAnchor="middle"
        fontSize="76"
        fontWeight="300"
        style={{
          fontFamily:
            "var(--font-cormorant), 'Cormorant Garamond', Georgia, serif",
        }}
      >
        {LETRAS.map((letra, i) => {
          const ultima = i === LETRAS.length - 1;
          const cor = ultima ? "var(--s-gold)" : "var(--s-ink)";
          return (
            <tspan
              key={i}
              fill={cor}
              stroke={desenhando ? cor : undefined}
              className={desenhando ? "s-marca-traco" : undefined}
              style={
                desenhando
                  ? { animationDelay: `${i * ATRASO_ENTRE_LETRAS}s` }
                  : undefined
              }
            >
              {letra}
            </tspan>
          );
        })}
      </text>
    </svg>
  );
}
