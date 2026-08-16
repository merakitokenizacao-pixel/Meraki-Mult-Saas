"use client";

import { motion } from "framer-motion";

const entra = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
};
const grupo = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

/**
 * Seção padrão do site: uma ideia à esquerda, o produto à direita (ou o
 * inverso, com `invertida`). Todas compartilham o mesmo respiro e o mesmo
 * ritmo de entrada — é o que faz a página descer inteira, sem solavanco.
 */
export function Secao({
  id,
  kicker,
  titulo,
  texto,
  visual,
  invertida = false,
  alt = false,
  largo = false,
}: {
  id?: string;
  kicker: string;
  titulo: React.ReactNode;
  texto: string;
  visual: React.ReactNode;
  invertida?: boolean;
  alt?: boolean;
  /** A agenda interativa precisa de mais largura que uma demo estática. */
  largo?: boolean;
}) {
  return (
    <section id={id} className={`s-secao${alt ? " s-secao-alt" : ""}`}>
      <motion.div
        variants={grupo}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-90px" }}
        className={`mx-auto grid items-center gap-16 lg:grid-cols-2 lg:gap-24 ${largo ? "max-w-6xl" : "max-w-5xl"}`}
      >
        <div className={invertida ? "lg:order-2" : undefined}>
          <motion.p variants={entra} className="s-kicker mb-7 text-s-gold">
            {kicker}
          </motion.p>
          <motion.h2
            variants={entra}
            className="s-display max-w-[15ch] text-[36px] leading-[1.06] text-s-ink sm:text-[48px]"
          >
            {titulo}
          </motion.h2>
          <motion.p
            variants={entra}
            className="mt-7 max-w-[42ch] text-[16.5px] leading-relaxed text-s-ink2"
          >
            {texto}
          </motion.p>
        </div>

        <motion.div
          variants={entra}
          transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          className={`flex justify-center ${
            invertida ? "lg:order-1 lg:justify-start" : "lg:justify-end"
          }`}
        >
          {visual}
        </motion.div>
      </motion.div>
    </section>
  );
}
