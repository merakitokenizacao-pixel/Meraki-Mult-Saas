"use client";

import { motion } from "framer-motion";
import { PhoneMockup } from "@/components/site/phone-mockup";

// Uma capacidade por seção, com o produto REAL ao lado — é o que a referência
// faz e o que nenhuma feature em bullet consegue: a prova está na tela.
const PONTOS = [
  {
    n: "01",
    titulo: "Responde na hora, com o preço certo",
    texto:
      "Ela conhece cada serviço e cada valor da sua tabela. Nada de “vou verificar e te retorno”.",
  },
  {
    n: "02",
    titulo: "Oferece a promoção que está no ar",
    texto:
      "As campanhas entram e saem sozinhas, com validade. Ela nunca vende uma promoção vencida.",
  },
  {
    n: "03",
    titulo: "Fecha o horário na mesma conversa",
    texto:
      "Sem mandar o cliente “falar com a recepção amanhã”. O agendamento acontece ali.",
  },
];

export function SecaoConversa() {
  return (
    <section id="conversa" className="s-secao">
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1fr_auto] lg:gap-24">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="s-eyebrow mb-5"
          >
            A conversa
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="s-display max-w-[15ch] text-[38px] text-s-ink sm:text-[52px]"
          >
            Do “quanto custa?” ao horário marcado.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-6 max-w-[46ch] text-[17px] leading-relaxed text-s-ink2"
          >
            É uma conversa real da clínica, sem corte. A cliente pergunta o
            preço às 14h32 e sai com quinta-feira reservada — sem ninguém da
            equipe digitar uma palavra.
          </motion.p>

          <div className="mt-12 flex flex-col gap-8">
            {PONTOS.map((p, i) => (
              <motion.div
                key={p.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: 0.06 * i }}
                className="grid grid-cols-[auto_1fr] gap-5 border-t border-s-line pt-6"
              >
                <span className="font-[family-name:var(--font-jetbrains)] text-[11px] tracking-widest text-s-gold">
                  {p.n}
                </span>
                <div>
                  <h3 className="text-[16.5px] font-medium text-s-ink">
                    {p.titulo}
                  </h3>
                  <p className="mt-1.5 max-w-[42ch] text-[14.5px] leading-relaxed text-s-muted">
                    {p.texto}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.75, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex justify-center lg:justify-end"
        >
          <PhoneMockup />
        </motion.div>
      </div>
    </section>
  );
}
