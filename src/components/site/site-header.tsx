"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/site/logo";
import { CTA_LABEL, SECOES, WHATSAPP_URL } from "@/lib/site";

// Header fixo. Ganha fundo e borda só depois que a página rola — no topo ele
// fica transparente, deixando o gradiente do hero respirar.
export function SiteHeader() {
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const onScroll = () => setRolou(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${
        rolou
          ? "border-b border-s-line bg-s-bg/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <a href="#topo" aria-label="VoraX — início" className="shrink-0">
          <Logo />
        </a>

        <nav aria-label="Seções" className="hidden items-center gap-8 md:flex">
          {SECOES.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="text-[14px] text-s-ink2 transition-colors hover:text-s-ink"
            >
              {s.label}
            </a>
          ))}
        </nav>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="s-btn s-btn-primary !px-5 !py-2.5 !text-[13.5px]"
        >
          <span className="hidden sm:inline">{CTA_LABEL}</span>
          <span className="sm:hidden">Falar no WhatsApp</span>
        </a>
      </div>
    </header>
  );
}
