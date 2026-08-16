"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  MARCA_LAYOUT_ID,
  useAberturaPronta,
} from "@/components/site/abertura";
import { MarcaSvg } from "@/components/site/marca-svg";
import { CTA_CURTO, WHATSAPP_URL } from "@/lib/site";

// Header no formato da referência: três colunas com a MARCA NO CENTRO.
// "Entrar" à esquerda (peso leve, quase um detalhe) e o CTA à direita, em
// pílula escura. Nada de menu de âncoras — é o que deixa o topo respirar.
export function SiteHeader() {
  const [rolou, setRolou] = useState(false);
  // A marca só aparece aqui depois que a abertura termina — é a chegada do
  // voo. Antes disso ela está no centro da tela, na abertura.
  const aberturaPronta = useAberturaPronta();

  // SENTINELA em vez de listener de scroll. O handler antigo rodava a cada
  // evento de rolagem só para virar um booleano — barato por evento, caro por
  // haver um a mais numa página que já estava engasgando. O observer avisa
  // quando o topo sai da tela e o navegador não chama nada no meio.
  const sentinela = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinela.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setRolou(!e.isIntersecting));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinela} aria-hidden className="absolute top-10 h-px w-px" />
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-300 ${
        rolou
          ? "border-b border-s-line/70 bg-s-bg"
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

        {/* Centro — a marca. Reserva o espaço mesmo antes de chegar, senão o
            header "pula" quando o logo aterrissa. */}
        <div className="flex h-[30px] w-[108px] items-center justify-self-center">
          {aberturaPronta && (
            <motion.a
              layoutId={MARCA_LAYOUT_ID}
              href="#topo"
              aria-label="VoraX — início"
              className="block w-[108px] text-s-ink"
              transition={{ duration: 0.85, ease: [0.65, 0, 0.35, 1] }}
            >
              <MarcaSvg className="w-full" />
            </motion.a>
          )}
        </div>

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
    </>
  );
}
