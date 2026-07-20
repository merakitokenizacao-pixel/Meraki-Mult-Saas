"use client";

import { motion } from "framer-motion";
import { ArrowDown, MessageCircle } from "lucide-react";
import {
  CTA_LABEL,
  HERO_IMAGEM,
  HERO_META,
  WHATSAPP_URL,
} from "@/lib/site";

const sobe = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
};
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.08 } },
};

// Hero editorial: só texto sobre atmosfera, ocupando a tela.
// O produto (o celular com a conversa) entra na PRÓXIMA seção, grande — é o
// que cria a descida. Empilhar tudo aqui achataria os dois.
export function Hero() {
  return (
    <section
      id="topo"
      className="s-hero relative flex min-h-[92vh] flex-col justify-between overflow-hidden px-5 pb-8 pt-32 sm:px-8 sm:pb-10 sm:pt-40"
    >
      {/* Atmosfera: foto opcional + luz + feixe + grão + vinheta */}
      {HERO_IMAGEM && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={HERO_IMAGEM} alt="" aria-hidden className="s-hero-foto" />
      )}
      <div className="s-hero-luz" aria-hidden />
      <div className="s-hero-feixe" aria-hidden />
      <div className="s-hero-grao" aria-hidden />
      <div className="s-hero-vinheta" aria-hidden />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center"
      >
        <motion.p
          variants={sobe}
          className="s-meta mb-7 flex items-center gap-2.5"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Atendendo agora, em clínica real
        </motion.p>

        <motion.h1
          variants={sobe}
          className="s-display max-w-[16ch] text-[54px] leading-[0.98] text-[#f7f4ee] sm:text-[80px] lg:text-[104px]"
        >
          Sua recepção nunca dorme.
        </motion.h1>

        <motion.p
          variants={sobe}
          className="mt-8 max-w-[46ch] text-[17.5px] leading-relaxed text-[#f4f1ea]/62 sm:text-[19px]"
        >
          A Laura atende, vende e agenda no WhatsApp 24 horas — e passa pra sua
          equipe na hora certa.
        </motion.p>

        <motion.div
          variants={sobe}
          className="mt-11 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="s-btn s-btn-luz"
          >
            <MessageCircle size={17} strokeWidth={1.8} />
            {CTA_LABEL}
          </a>
          <a href="#conversa" className="s-btn s-btn-linha">
            Ver como funciona
            <ArrowDown size={15} strokeWidth={1.8} />
          </a>
        </motion.div>
      </motion.div>

      {/* Rodapé do hero: metadados editoriais, como assinatura de capa */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.7 }}
        className="mx-auto flex w-full max-w-5xl items-end justify-between gap-6 border-t border-white/8 pt-6"
      >
        <div className="s-meta flex flex-wrap gap-x-5 gap-y-1">
          {HERO_META.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
        <span className="s-meta hidden sm:block">VoraX</span>
      </motion.div>
    </section>
  );
}
