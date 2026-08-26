import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Inter,
  JetBrains_Mono,
  Jost,
  Space_Grotesk,
} from "next/font/google";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

// A sans da INTERFACE. Desenhada para texto pequeno em tela: x-height alta,
// aberturas abertas, pouco contraste de traço. É o oposto do que a Jost faz.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Só a landing usa. Lá ela é título grande, e o geométrico trabalha a favor.
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

// ── Sistema Meraki ──
// Space Grotesk em NÚMERO e TÍTULO. Grotesca de traço mecânico, com dígitos de
// largura constante e formas fechadas — é o oposto do Cormorant, que tem
// largura variável por dígito e faz o valor dançar de um card para o outro.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// IBM Plex Sans no CORPO. Desenhada para tela em corpo pequeno, e
// suficientemente diferente da Space Grotesk para que número e rótulo não se
// confundam quando estão a 4px de distância.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// IBM Plex Mono em DADO TABULAR — coluna de valores, horário, telefone.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meraki",
  description: "Atendimento e agenda com IA para clínicas.",
};

// Root layout MÍNIMO: só <html>/<body> e as fontes.
//
// Nem CSS nem script de tema moram aqui — cada route group carrega o seu:
//   (painel) e (auth)  → globals.css + o script anti-flash do tema
//   (publico)          → globals.css (a ficha usa o subconjunto dela)
//   (site)             → site.css, tokens próprios, SEM nada do painel
//
// É isso que garante que a landing em `/` não baixe o CSS do CRM nem seja
// afetada pelo tema escuro que a dona tenha salvo no localStorage.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${cormorant.variable} ${inter.variable} ${jost.variable} ${jetbrains.variable} ${spaceGrotesk.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
