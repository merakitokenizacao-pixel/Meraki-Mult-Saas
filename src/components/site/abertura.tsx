"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MarcaSvg } from "@/components/site/marca-svg";

/** id compartilhado: é ele que faz o logo VOAR da abertura para o header. */
export const MARCA_LAYOUT_ID = "meraki-marca";

/**
 * `true`  → a abertura roda em TODA visita (é o que está valendo).
 * `false` → roda só uma vez por sessão (guarda em sessionStorage).
 *
 * Trocar aqui é o único passo: o resto do fluxo já respeita a flag.
 */
const SEMPRE = true;

const CHAVE = "meraki-abertura";
// A última letra (X) começa em 4×0,13s e leva 1,15s → termina em ~1,67s.
// Mais um respiro para a marca cheia ser lida antes de voar pro header.
const DURACAO_MS = 2150;

const Ctx = createContext(false);
/** `true` quando a abertura terminou — o header só mostra a marca depois. */
export const useAberturaPronta = () => useContext(Ctx);

declare global {
  interface Window {
    __merakiAberturaVista?: boolean;
  }
}

export function Abertura({ children }: { children: ReactNode }) {
  const semMovimento = useReducedMotion();
  const [pronta, setPronta] = useState(false);

  useEffect(() => {
    // Entra direto se: já viu nesta sessão (quando SEMPRE=false) ou o sistema
    // pediu menos movimento (acessibilidade — respeitado mesmo com SEMPRE).
    const jaViu =
      !SEMPRE &&
      typeof window !== "undefined" &&
      (window.__merakiAberturaVista || sessionStorage.getItem(CHAVE) === "1");

    if (jaViu || semMovimento) {
      setPronta(true);
      return;
    }

    // Trava a rolagem enquanto a abertura ocupa a tela.
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const t = setTimeout(() => {
      setPronta(true);
      if (!SEMPRE) {
        try {
          sessionStorage.setItem(CHAVE, "1");
        } catch {
          /* modo anônimo com storage bloqueado: só não memoriza */
        }
      }
      document.body.style.overflow = overflowAntes;
    }, DURACAO_MS);

    return () => {
      clearTimeout(t);
      document.body.style.overflow = overflowAntes;
    };
  }, [semMovimento]);

  return (
    <Ctx.Provider value={pronta}>
      {/* O fundo escuro esmaece; a marca sai daqui e reaparece no header com
          o mesmo layoutId — o framer faz o percurso entre as duas posições. */}
      <AnimatePresence>
        {!pronta && (
          <motion.div
            key="abertura"
            className="s-abertura"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.65, 0, 0.35, 1] }}
          >
            {/* Mesma textura do hero: sem o grão, o branco vira placa chapada */}
            <div className="s-hero-grao" aria-hidden />
            <div className="relative flex flex-col items-center gap-6">
              <motion.div layoutId={MARCA_LAYOUT_ID}>
                <MarcaSvg desenhando className="w-[min(62vw,300px)]" />
              </motion.div>
              <div className="s-abertura-linha w-[min(46vw,220px)]" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {children}
    </Ctx.Provider>
  );
}
