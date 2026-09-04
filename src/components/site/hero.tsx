"use client";

import { motion } from "framer-motion";
import { WHATSAPP_URL, AGENTE_VITRINE } from "@/lib/site";
import { ArrowDown } from "lucide-react";
import { LuzFundo } from "@/components/site/luz-fundo";
import { HERO_IMAGEM } from "@/lib/site";

const sobe = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.13, delayChildren: 0.12 } },
};

// Hero claro e centralizado, no formato da referência: sobrelinha, headline
// grande, uma linha de subtexto e um convite discreto para descer.
//
// De propósito NÃO tem botão de conversão aqui: o CTA vive no header, que é
// fixo e acompanha a rolagem. É isso que deixa o hero respirar.
export function Hero() {
  return (
    <section
      id="topo"
      className="s-hero flex min-h-[100svh] flex-col items-center justify-center px-6 py-32 text-center"
    >
      {HERO_IMAGEM && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={HERO_IMAGEM}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
      )}
      <LuzFundo />
      <div className="s-hero-grao" aria-hidden />

      {/* Assinatura editorial nas quatro quinas */}
      <span className="s-vertical s-vertical-esq top-24">Brasília · Brasil</span>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-[2] mx-auto flex max-w-4xl flex-col items-center"
      >
        <motion.h1
          variants={sobe}
          className="s-display text-[46px] leading-[1.02] text-s-ink sm:text-[68px] lg:text-[86px]"
        >
          Sua melhor profissional
          <br />
          parou de ser <span className="text-s-gold">recepcionista.</span>
        </motion.h1>

        <motion.p
          variants={sobe}
          className="mt-8 max-w-[44ch] text-[16.5px] leading-relaxed text-s-ink2 sm:text-[18px]"
        >
          A {AGENTE_VITRINE} atende no WhatsApp, conhece a escala inteira e marca
          sozinha. Você volta pra cadeira.
        </motion.p>

        {/* O CTA do hero abre o WhatsApp da clínica-demo: o jeito mais curto
            de decidir é conversar com ela, não rolar a página. "Ver por dentro"
            fica como caminho secundário, discreto. */}
        <motion.div variants={sobe} className="s-hero-acoes mt-14">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="s-btn s-btn-primary"
          >
            Fale com a {AGENTE_VITRINE}
          </a>
          <a href="#conversa" className="s-hero-secundario">
            Ver por dentro
            <ArrowDown size={14} strokeWidth={1.7} />
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
