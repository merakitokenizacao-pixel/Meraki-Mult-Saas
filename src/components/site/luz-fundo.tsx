// Ondas de luz do hero — 100% SVG, nenhuma imagem.
//
// A referência usa uma peça abstrata de luz (não uma foto): faixas largas,
// muito borradas, quase brancas, atravessando a tela. Aqui as faixas usam a
// paleta quente do Meraki (dourado/creme) em vez do azul — assim a atmosfera é
// nossa, não uma cópia.
//
// Como funciona: cada onda é um traço (stroke) grosso sobre uma curva, com um
// gradiente que nasce e morre transparente. O feGaussianBlur pesado transforma
// o traço numa faixa de luz difusa.
export function LuzFundo() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      focusable="false"
    >
      <defs>
        {/* Dourado quente */}
        <linearGradient id="lz-ouro" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#d9bd91" stopOpacity="0" />
          <stop offset="38%" stopColor="#e3c9a2" stopOpacity="0.85" />
          <stop offset="72%" stopColor="#f2e4cd" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Creme claro — a onda mais larga, quase branca */}
        <linearGradient id="lz-creme" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="45%" stopColor="#f6efe2" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Verde-acinzentado bem lavado, para o contraponto frio */}
        <linearGradient id="lz-frio" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dfe7e3" stopOpacity="0" />
          <stop offset="50%" stopColor="#dde8e4" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <filter id="lz-suave" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="34" />
        </filter>
        <filter id="lz-muito-suave" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="58" />
        </filter>
      </defs>

      {/* Faixa larga cruzando por baixo — dá o "chão" de luz */}
      <g filter="url(#lz-muito-suave)">
        <path
          d="M-180,760 C240,610 520,830 860,650 C1130,505 1330,600 1620,470"
          stroke="url(#lz-creme)"
          strokeWidth="210"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* Onda dourada principal, subindo da esquerda */}
      <g filter="url(#lz-suave)">
        <path
          d="M-160,880 C260,700 480,830 820,630 C1090,470 1290,520 1600,360"
          stroke="url(#lz-ouro)"
          strokeWidth="86"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M-140,660 C220,540 460,690 760,520 C1010,378 1240,430 1580,290"
          stroke="url(#lz-ouro)"
          strokeWidth="42"
          fill="none"
          strokeLinecap="round"
          opacity="0.62"
        />
      </g>

      {/* Contraponto frio vindo do topo direito */}
      <g filter="url(#lz-suave)">
        <path
          d="M1580,90 C1260,190 1080,120 820,270 C600,398 430,360 -120,560"
          stroke="url(#lz-frio)"
          strokeWidth="120"
          fill="none"
          strokeLinecap="round"
          opacity="0.75"
        />
      </g>

      {/* Fio fino de luz, quase imperceptível — é o que dá o toque de "seda" */}
      <g filter="url(#lz-suave)">
        <path
          d="M-100,520 C300,430 560,540 900,400 C1140,300 1340,340 1600,220"
          stroke="#ffffff"
          strokeWidth="16"
          fill="none"
          strokeLinecap="round"
          opacity="0.85"
        />
      </g>
    </svg>
  );
}
