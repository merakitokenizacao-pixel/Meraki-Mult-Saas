"use client";

import { useEffect, useState } from "react";
import { CTA_CURTO, WHATSAPP_URL } from "@/lib/site";

// Header no formato da referência: três colunas com a MARCA NO CENTRO.
// "Entrar" à esquerda (peso leve, quase um detalhe) e o CTA à direita, em
// pílula escura. Nada de menu de âncoras — é o que deixa o topo respirar.
export function SiteHeader() {
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const onScroll = () => setRolou(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${
        rolou
          ? "border-b border-s-line/70 bg-s-bg/80 backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <div className="grid h-[76px] grid-cols-[1fr_auto_1fr] items-center px-6 sm:px-12 lg:px-20">
        {/* Esquerda — acesso ao painel */}
        <div className="justify-self-start">
          <a
            href="/login"
            className="text-[14.5px] text-s-ink2 transition-colors hover:text-s-ink"
          >
            Entrar
          </a>
        </div>

        {/* Centro — a marca */}
        <a
          href="#topo"
          aria-label="VoraX — início"
          className="justify-self-center font-[family-name:var(--font-cormorant)] text-[27px] font-light leading-none tracking-[0.02em] text-s-ink"
        >
          Vora<span className="text-s-gold">X</span>
        </a>

        {/* Direita — conversão */}
        <div className="justify-self-end">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="s-btn s-btn-primary !px-6 !py-3 !text-[13.5px]"
          >
            {CTA_CURTO}
          </a>
        </div>
      </div>
    </header>
  );
}
