"use client";

import { motion } from "framer-motion";
import { PhoneMockup } from "@/components/site/phone-mockup";

const entra = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
};
const grupo = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

// Uma ideia por seção, com o produto real ao lado. Pouco texto de propósito:
// a conversa no celular é o argumento — explicar demais rouba a atenção dela.
export function SecaoConversa() {
  return (
    <section id="conversa" className="s-secao">
      <motion.div
        variants={grupo}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-90px" }}
        className="mx-auto grid max-w-5xl items-center gap-16 lg:grid-cols-[1fr_auto] lg:gap-28"
      >
        <div>
          <motion.p variants={entra} className="s-kicker mb-7 text-s-gold">
            A conversa
          </motion.p>

          <motion.h2
            variants={entra}
            className="s-display max-w-[14ch] text-[36px] leading-[1.06] text-s-ink sm:text-[50px]"
          >
            Do “quanto custa?” ao horário marcado.
          </motion.h2>

          <motion.p
            variants={entra}
            className="mt-7 max-w-[40ch] text-[16.5px] leading-relaxed text-s-ink2"
          >
            Uma conversa real da clínica, sem corte. A cliente pergunta o preço
            às 14h32 e sai com quinta-feira reservada — sem ninguém da equipe
            digitar uma palavra.
          </motion.p>
        </div>

        <motion.div
          variants={entra}
          transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex justify-center lg:justify-end"
        >
          <PhoneMockup />
        </motion.div>
      </motion.div>
    </section>
  );
}
