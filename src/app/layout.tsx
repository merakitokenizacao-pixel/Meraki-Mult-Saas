import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Jost, JetBrains_Mono } from "next/font/google";

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
      className={`${cormorant.variable} ${inter.variable} ${jost.variable} ${jetbrains.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
