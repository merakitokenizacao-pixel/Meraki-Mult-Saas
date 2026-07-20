"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, Phone, Video } from "lucide-react";

// Conversa REAL (anonimizada) entre uma cliente e a Laura.
// `*texto*` é negrito do WhatsApp — renderizado abaixo por `formatar`.
type Msg = { de: "cliente" | "laura"; texto: string; hora: string };

const CONVERSA: Msg[] = [
  { de: "cliente", texto: "quanto tá a drenagem?", hora: "14:32" },
  {
    de: "laura",
    texto:
      "A *Drenagem Linfática* sai por *R$ 100,00* a sessão. E esse mês ela entra numa promoção: pacote com 30 procedimentos por *R$ 499,90*.",
    hora: "14:32",
  },
  { de: "cliente", texto: "quero marcar! quinta às 15h tem?", hora: "14:33" },
  {
    de: "laura",
    texto:
      "Tem sim! Quinta às 15h é seu. Me fala teu nome completo que eu já deixo reservado.",
    hora: "14:33",
  },
];

// Converte o *negrito* do WhatsApp em <strong>, sem dangerouslySetInnerHTML.
function formatar(texto: string) {
  return texto.split(/(\*[^*]+\*)/g).map((parte, i) =>
    parte.startsWith("*") && parte.endsWith("*") && parte.length > 2 ? (
      <strong key={i}>{parte.slice(1, -1)}</strong>
    ) : (
      <span key={i}>{parte}</span>
    )
  );
}

// Ritmo da encenação: quanto tempo o "digitando…" fica no ar antes de cada
// resposta da Laura, e a pausa entre as mensagens da cliente.
const PAUSA_ANTES = 620;
const DIGITANDO = 1150;

export function PhoneMockup() {
  const semMovimento = useReducedMotion();
  // Começa em 1 (não 0) de propósito: assim a primeira mensagem já vem no HTML
  // do servidor e o celular nunca aparece vazio enquanto o JS carrega. O resto
  // da conversa entra animado. Com "menos movimento", mostra tudo de uma vez.
  const [visiveis, setVisiveis] = useState(semMovimento ? CONVERSA.length : 1);
  const [digitando, setDigitando] = useState(false);

  useEffect(() => {
    if (semMovimento) {
      setVisiveis(CONVERSA.length);
      return;
    }
    if (visiveis >= CONVERSA.length) return;

    const proxima = CONVERSA[visiveis];
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (proxima.de === "laura") {
      // A Laura "pensa" antes de responder — é o que dá vida à cena.
      timers.push(
        setTimeout(() => setDigitando(true), PAUSA_ANTES),
        setTimeout(() => {
          setDigitando(false);
          setVisiveis((v) => v + 1);
        }, PAUSA_ANTES + DIGITANDO)
      );
    } else {
      timers.push(setTimeout(() => setVisiveis((v) => v + 1), PAUSA_ANTES + 260));
    }

    return () => timers.forEach(clearTimeout);
  }, [visiveis, semMovimento]);

  return (
    <div className="s-phone">
      <div className="s-phone-screen">
        <div className="s-phone-notch" aria-hidden />

        {/* Cabeçalho da conversa */}
        <div className="flex shrink-0 items-center gap-2.5 bg-[#1f2c33] px-3 pb-2.5 pt-9">
          <ChevronLeft size={17} className="shrink-0 text-[#aebac1]" aria-hidden />
          <div
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#b8955a] to-[#9b7d5a] font-[family-name:var(--font-cormorant)] text-[15px] font-medium text-white"
            aria-hidden
          >
            L
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium leading-tight text-[#e9edef]">
              Laura · LINS Estética
            </div>
            <div className="text-[10.5px] leading-tight text-[#8696a0]">online</div>
          </div>
          <Video size={16} className="shrink-0 text-[#aebac1]" aria-hidden />
          <Phone size={15} className="shrink-0 text-[#aebac1]" aria-hidden />
        </div>

        {/* Conversa. aria-live faz o leitor de tela anunciar as mensagens que entram. */}
        <div className="s-chat" aria-live="polite">
          {CONVERSA.slice(0, visiveis).map((m, i) => (
            <motion.div
              key={i}
              initial={semMovimento ? false : { opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
              className={`s-bubble ${m.de === "laura" ? "s-bubble-in" : "s-bubble-out"}`}
            >
              {formatar(m.texto)}
              <span className="s-bubble-time">
                {m.hora}
                {m.de === "cliente" && (
                  <Check size={11} className="ml-0.5 inline text-[#53bdeb]" aria-hidden />
                )}
              </span>
            </motion.div>
          ))}

          <AnimatePresence>
            {digitando && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22 }}
                className="s-typing"
                aria-label="Laura está digitando"
              >
                <span />
                <span />
                <span />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Campo de digitação (decorativo) */}
        <div className="flex shrink-0 items-center gap-2 bg-[#1f2c33] px-2.5 py-2" aria-hidden>
          <div className="flex-1 rounded-full bg-[#2a3942] px-3 py-2 text-[11.5px] text-[#8696a0]">
            Mensagem
          </div>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--s-wa-green)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#0b141a">
              <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
