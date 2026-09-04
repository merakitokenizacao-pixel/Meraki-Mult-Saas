import { AGENTE_VITRINE } from "@/lib/site";
import type { Metadata } from "next";
import "./site.css";
import { Abertura } from "@/components/site/abertura";
import { SiteHeader } from "@/components/site/site-header";

export const metadata: Metadata = {
  title: "Meraki — sua clínica atendendo 24h no WhatsApp",
  description:
    `A ${AGENTE_VITRINE} é a atendente de IA que responde no WhatsApp da sua clínica, controla a agenda de verdade e passa pra sua equipe na hora certa.`,
  robots: { index: true, follow: true },
};

// Roda ANTES da pintura: se a abertura já foi vista nesta sessão, marca o
// <html> e o CSS esconde a tela escura na hora — sem isso, quem volta pisca o
// fundo escuro por um quadro (mesmo truque do anti-flash do tema).
//
// Enquanto `SEMPRE = true` em abertura.tsx, a chave nunca é gravada, então
// este script não faz nada — mas fica pronto para quando a flag mudar.
const scriptAbertura = `(function(){try{if(sessionStorage.getItem('meraki-abertura')==='1'){document.documentElement.setAttribute('data-abertura','vista');window.__merakiAberturaVista=true;}}catch(e){}})();`;

// Site institucional. Não herda NADA do painel: nem globals.css, nem os
// providers, nem o script de tema. Ver `src/app/layout.tsx`.
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: scriptAbertura }} />
      <div className="site-root">
        <Abertura>
          <SiteHeader />
          <main>{children}</main>
        </Abertura>
      </div>
    </>
  );
}
