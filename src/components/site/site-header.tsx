"use client";

import { useEffect, useState } from "react";
import { CTA_LABEL, SECOES, WHATSAPP_URL } from "@/lib/site";

// Header fixo que se inverte: sobre o hero escuro ele é claro e transparente;
// ao rolar, ganha fundo claro e o texto escurece. Sem isso o menu sumiria —
// contra o hero preto no topo, contra o fundo branco depois.
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
          ? "border-b border-s-line bg-s-bg/88 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <a
          href="#topo"
          aria-label="VoraX — início"
          className={`shrink-0 font-[family-name:var(--font-cormorant)] text-[26px] font-light leading-none transition-colors duration-300 ${
            rolou ? "text-s-ink" : "text-[#f7f4ee]"
          }`}
        >
          Vora<span className="text-s-gold2">X</span>
        </a>

        <nav aria-label="Seções" className="hidden items-center gap-8 md:flex">
          {SECOES.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className={`text-[14px] transition-colors duration-300 ${
                rolou
                  ? "text-s-ink2 hover:text-s-ink"
                  : "text-[#f4f1ea]/70 hover:text-[#f7f4ee]"
              }`}
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {/* A dona entra no painel pelo mesmo domínio */}
          <a
            href="/login"
            className={`hidden text-[14px] transition-colors duration-300 sm:block ${
              rolou
                ? "text-s-ink2 hover:text-s-ink"
                : "text-[#f4f1ea]/70 hover:text-[#f7f4ee]"
            }`}
          >
            Entrar
          </a>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`s-btn !px-5 !py-2.5 !text-[13.5px] ${
              rolou ? "s-btn-primary" : "s-btn-luz"
            }`}
          >
            <span className="hidden sm:inline">{CTA_LABEL}</span>
            <span className="sm:hidden">Falar no WhatsApp</span>
          </a>
        </div>
      </div>
    </header>
  );
}
