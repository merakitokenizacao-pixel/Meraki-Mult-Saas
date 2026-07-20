import type { Metadata } from "next";
import "./site.css";
import { SiteHeader } from "@/components/site/site-header";

export const metadata: Metadata = {
  title: "VoraX — sua clínica atendendo 24h no WhatsApp",
  description:
    "A Laura é a atendente de IA que responde no WhatsApp da sua clínica, controla a agenda de verdade e passa pra sua equipe na hora certa.",
  robots: { index: true, follow: true },
};

// Site institucional. Não herda NADA do painel: nem globals.css, nem os
// providers, nem o script de tema. Ver `src/app/layout.tsx`.
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="site-root">
      <SiteHeader />
      <main>{children}</main>
    </div>
  );
}
