"use client";

import { motion } from "framer-motion";
import { APURACAO, NUMEROS_PREENCHIDOS } from "@/lib/site-numeros";

const entra = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0 } };
const grupo = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

// A clínica real. É o que o concorrente não tem — e o que nenhuma frase de
// venda substitui.
//
// Os números vivem em `lib/site-numeros.ts` e ainda estão VAZIOS: enquanto
// estiverem, a faixa não é renderizada. Número inventado numa página que vende
// confiabilidade é o pior lugar possível para inventar — a dona confere em
// trinta segundos e para de acreditar no resto junto.
export function SecaoNumeros() {
  const temNumeros = APURACAO.trim() !== "" && NUMEROS_PREENCHIDOS.length > 0;

  return (
    <section className="s-secao">
      <motion.div
        variants={grupo}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-90px" }}
        className="mx-auto max-w-4xl"
      >
        <motion.p variants={entra} className="s-kicker mb-7 text-s-gold">
          Nº 001
        </motion.p>
        <motion.h2
          variants={entra}
          className="s-display max-w-[18ch] text-[36px] leading-[1.06] text-s-ink sm:text-[50px]"
        >
          LINS Estética Avançada, Brasília.
        </motion.h2>
        <motion.p
          variants={entra}
          className="mt-7 max-w-[46ch] text-[16.5px] leading-relaxed text-s-ink2"
        >
          A primeira. Não é piloto nem demonstração: é a clínica onde a Laura
          atende todo dia, com a agenda de verdade e as clientes de verdade.
        </motion.p>

        {temNumeros && (
          <>
            <motion.div variants={entra} className="s-numeros">
              {NUMEROS_PREENCHIDOS.map((n) => (
                <div key={n.rotulo} className="s-numero">
                  <span className="s-numero-valor">{n.valor}</span>
                  <span className="s-numero-rotulo">{n.rotulo}</span>
                </div>
              ))}
            </motion.div>
            {/* A data ao lado do número: sem ela, "2.400 mensagens" continua na
                tela em 2027 parecendo atual. */}
            <motion.p variants={entra} className="s-numeros-data">
              Números de {APURACAO}
            </motion.p>
          </>
        )}
      </motion.div>
    </section>
  );
}
