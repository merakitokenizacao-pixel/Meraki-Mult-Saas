"use client";

import { motion } from "framer-motion";
import { WHATSAPP_URL } from "@/lib/site";

const entra = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0 } };
const grupo = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

// O fecho convida a TESTAR, não a se candidatar. Nada de "aplique-se" nem de
// escassez de trimestre: quem vende autonomia não pode terminar pedindo
// permissão.
export function SecaoCta() {
  return (
    <section className="s-secao s-secao-alt">
      <motion.div
        variants={grupo}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-90px" }}
        className="mx-auto max-w-3xl text-center"
      >
        <motion.h2
          variants={entra}
          className="s-display text-[34px] leading-[1.08] text-s-ink sm:text-[46px]"
        >
          O jeito mais rápido de decidir é perguntar pra ela.
        </motion.h2>
        <motion.p
          variants={entra}
          className="mx-auto mt-7 max-w-[44ch] text-[16.5px] leading-relaxed text-s-ink2"
        >
          Manda mensagem como se fosse sua cliente. Pergunta preço, tenta
          marcar, tenta confundir. É a mesma Laura que atende a LINS.
        </motion.p>
        <motion.a
          variants={entra}
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="s-btn s-btn-primary mt-10"
        >
          Fale com a Laura
        </motion.a>
      </motion.div>
    </section>
  );
}
