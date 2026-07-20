"use client";

import { motion } from "framer-motion";
import { ArrowDown, MessageCircle } from "lucide-react";
import { PhoneMockup } from "@/components/site/phone-mockup";
import { CTA_LABEL, WHATSAPP_URL } from "@/lib/site";

// Entrada escalonada: cada elemento sobe um pouquinho depois do anterior.
const sobe = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

export function Hero() {
  return (
    <section id="topo" className="relative overflow-hidden px-5 pb-20 pt-32 sm:px-8 sm:pb-28 sm:pt-40">
      {/* Gradientes de fundo — puro CSS, sem imagem */}
      <div
        className="s-bloom left-[-10%] top-[-14%] h-[520px] w-[520px] opacity-60"
        style={{ background: "radial-gradient(circle, #f0e2cc 0%, transparent 68%)" }}
        aria-hidden
      />
      <div
        className="s-bloom right-[-14%] top-[6%] h-[560px] w-[560px] opacity-50"
        style={{ background: "radial-gradient(circle, #dce8e2 0%, transparent 68%)" }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_auto] lg:gap-16">
        {/* Coluna do texto */}
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.div variants={sobe} className="mb-6 inline-flex items-center gap-2 rounded-full border border-s-line bg-s-surface/70 px-3.5 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[12px] font-medium text-s-ink2">
              Atendendo agora, em clínica real
            </span>
          </motion.div>

          <motion.h1
            variants={sobe}
            className="s-display text-[42px] text-s-ink sm:text-[56px] lg:text-[62px]"
          >
            Sua clínica atendendo, vendendo e agendando{" "}
            <span className="relative whitespace-nowrap">
              <em className="not-italic text-s-gold">24h</em>
            </span>{" "}
            no WhatsApp.
          </motion.h1>

          <motion.p
            variants={sobe}
            className="mt-6 max-w-[540px] text-[17px] leading-relaxed text-s-ink2 sm:text-[18.5px]"
          >
            A Laura é a atendente de IA que conhece cada cliente, controla a
            agenda de verdade e passa pra sua equipe na hora certa.
          </motion.p>

          <motion.div variants={sobe} className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="s-btn s-btn-primary"
            >
              <MessageCircle size={17} strokeWidth={1.8} />
              {CTA_LABEL}
            </a>
            <a href="#como-funciona" className="s-btn s-btn-ghost">
              Ver como funciona
              <ArrowDown size={15} strokeWidth={1.8} />
            </a>
          </motion.div>

          <motion.p variants={sobe} className="mt-6 text-[13px] text-s-muted">
            Sem app novo pra sua equipe aprender. É o WhatsApp que a clínica já usa.
          </motion.p>
        </motion.div>

        {/* Coluna do celular */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex justify-center lg:justify-end"
        >
          <PhoneMockup />
        </motion.div>
      </div>
    </section>
  );
}
