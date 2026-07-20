"use client";

import { motion } from "framer-motion";
import { Bell, MapPin, Mic, Tag, type LucideIcon } from "lucide-react";

// O que não virou seção própria fica aqui, leve: título + uma frase.
// Sem card, sem sombra — só uma linha separando. É o que a referência faz.
const FEATURES: { icon: LucideIcon; titulo: string; texto: string }[] = [
  {
    icon: Mic,
    titulo: "Atende por texto e áudio",
    texto:
      "Entende mensagens de voz como uma atendente de verdade — a cliente manda um áudio de trinta segundos e ela responde.",
  },
  {
    icon: Bell,
    titulo: "Confirmação de véspera",
    texto:
      "Lembra a cliente no dia anterior e reduz faltas, sem ninguém da equipe digitar nada.",
  },
  {
    icon: Tag,
    titulo: "Promoções com validade",
    texto:
      "As ofertas entram e saem do ar sozinhas. Ela nunca vende uma campanha que já venceu.",
  },
  {
    icon: MapPin,
    titulo: "Localização em um toque",
    texto:
      "Envia o mapa fixado da clínica direto na conversa, quando a cliente pergunta onde fica.",
  },
];

export function SecaoFeatures() {
  return (
    <section className="s-secao s-secao-alt">
      <div className="mx-auto max-w-5xl">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          className="s-kicker mb-7 text-s-gold"
        >
          E mais
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ delay: 0.06 }}
          className="s-display max-w-[16ch] text-[36px] leading-[1.06] text-s-ink sm:text-[48px]"
        >
          Cada detalhe já resolvido.
        </motion.h2>

        <div className="mt-16 grid gap-x-16 gap-y-12 sm:grid-cols-2">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.titulo}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: 0.05 * i }}
                className="s-feature"
              >
                <Icon size={19} strokeWidth={1.4} className="mb-4 text-s-gold" />
                <h3 className="text-[16.5px] font-medium text-s-ink">
                  {f.titulo}
                </h3>
                <p className="mt-2 max-w-[38ch] text-[14.5px] leading-relaxed text-s-muted">
                  {f.texto}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
