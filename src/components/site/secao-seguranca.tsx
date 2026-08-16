"use client";

import { motion } from "framer-motion";
import { TriangleAlert } from "lucide-react";

const entra = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0 } };
const grupo = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

// O alerta É o assunto desta seção, então ele não vai dentro de um cartão
// branco no canto: vai grande, direto na página. Pôr a coisa mais importante da
// seção dentro de uma moldura de 320px era enterrar o argumento.
export function SecaoSeguranca() {
  return (
    <section className="s-secao s-secao-alt">
      <motion.div
        variants={grupo}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-90px" }}
        className="mx-auto max-w-4xl"
      >
        <motion.p variants={entra} className="s-kicker mb-7 text-s-gold">
          A segurança
        </motion.p>
        <motion.h2
          variants={entra}
          className="s-display max-w-[16ch] text-[36px] leading-[1.06] text-s-ink sm:text-[50px]"
        >
          O “não” que protege a clínica.
        </motion.h2>
        <motion.p
          variants={entra}
          className="mt-7 max-w-[46ch] text-[16.5px] leading-relaxed text-s-ink2"
        >
          Antes do laser, a ficha vai pelo WhatsApp. Gestante, medicação
          fotossensível, procedimento recente — o alerta chega antes da cliente.
          Marcar é fácil. Desmarcar na hora é que custa caro.
        </motion.p>

        <motion.div variants={entra} className="s-alerta">
          <TriangleAlert size={20} strokeWidth={1.9} />
          <div>
            <span className="s-alerta-rotulo">Contraindicação</span>
            <p className="s-alerta-linha">
              Usa isotretinoína há menos de 6 meses
            </p>
            <p className="s-alerta-nota">
              O laser não pode ser feito. A equipe vê isso no cadastro antes de
              a cliente chegar.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
