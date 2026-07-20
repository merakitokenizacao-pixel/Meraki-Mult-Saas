"use client";

import { motion } from "framer-motion";
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
      <span className="s-vertical s-vertical-esq bottom-10">MMXXVI</span>
      <span className="s-vertical s-vertical-dir top-24">
        IA · Atendimento autônomo
      </span>
      <span className="s-vertical s-vertical-dir bottom-10">Nº 001</span>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-[2] mx-auto flex max-w-4xl flex-col items-center"
      >
        <motion.p variants={sobe} className="s-kicker mb-9">
          Edição 2026
        </motion.p>

        <motion.h1
          variants={sobe}
          className="s-display text-[46px] leading-[1.02] text-s-ink sm:text-[68px] lg:text-[86px]"
        >
          Sua recepção
          <br />
          <span className="text-s-gold">nunca dorme.</span>
        </motion.h1>

        <motion.p
          variants={sobe}
          className="mt-8 max-w-[44ch] text-[16.5px] leading-relaxed text-s-ink2 sm:text-[18px]"
        >
          A Laura atende, vende e agenda no WhatsApp 24 horas — e passa pra sua
          equipe na hora certa.
        </motion.p>

        <motion.a variants={sobe} href="#conversa" className="s-descobrir mt-14">
          Descobrir
          <span className="s-descobrir-circulo">
            <ArrowDown size={15} strokeWidth={1.6} />
          </span>
        </motion.a>
      </motion.div>
    </section>
  );
}
