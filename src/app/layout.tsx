import type { Metadata } from "next";
import { Cormorant_Garamond, Jost, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "VoraX CRM",
  description: "CRM para clínicas de estética — LINS Estética",
};

// Aplica o tema salvo antes da pintura, evitando flash (replica o toggleTheme do legacy)
const themeScript = `(function(){try{var t=localStorage.getItem('vorax-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`;

// Root layout enxuto de propósito: só o que é global a TODA rota.
// O chrome do painel (sidebar/topbar/providers) vive em `(painel)/layout.tsx`,
// para que as rotas públicas — ex.: /ficha/[token], aberta por pacientes —
// não herdem nada do CRM. Ver CLAUDE.md, "Rotas públicas".
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${cormorant.variable} ${jost.variable} ${jetbrains.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
