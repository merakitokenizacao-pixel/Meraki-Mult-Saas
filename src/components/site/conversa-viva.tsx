"use client";

import { useEffect, useRef, useState } from "react";

// A conversa que a Laura teve, entrando em sequência.
//
// SEM MOLDURA DE CELULAR: nada de notch, ícone de chamada ou "online". A
// conversa é o produto; o aparelho é embalagem, e embalagem desenhada rouba a
// atenção do que ela deveria emoldurar.
//
// O VERDE DO WHATSAPP FICA. Trocar por dourado deixaria a página mais coerente
// e a prova mais fraca: é o verde que faz o cérebro reconhecer a plataforma em
// 200ms. Sem ele, isto vira mockup de agência.
//
// Os horários saem de dentro dos balões e viram número grande na margem: o
// MINUTO DECORRIDO é o argumento inteiro da seção, e ele estava em cinza de
// 10px no canto de uma bolha.

interface Fala {
  de: "cliente" | "laura";
  texto: string;
  /** Só na primeira e na última: são as duas pontas do minuto. */
  hora?: string;
}

const FALAS: Fala[] = [
  { de: "cliente", texto: "oi, quanto tá a drenagem?", hora: "14:32" },
  {
    de: "laura",
    texto:
      "Oi! A drenagem linfática sai por R$ 100 a sessão. Este mês tem promoção: 10 sessões por R$ 499,90.",
  },
  { de: "cliente", texto: "e tem horário essa semana?" },
  {
    de: "laura",
    texto: "Tenho quinta às 15h e sexta às 9h. Alguma serve?",
  },
  { de: "cliente", texto: "quinta às 15" },
  {
    de: "laura",
    texto: "Prontinho, quinta 15h reservado no seu nome. Te espero!",
    hora: "14:33",
  },
];

const PAUSA = 700;
const DIGITANDO = 550;

export function ConversaViva() {
  const ref = useRef<HTMLDivElement>(null);
  const [visiveis, setVisiveis] = useState(0);
  const [digitando, setDigitando] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Com a preferência ligada, a conversa aparece INTEIRA de uma vez. Não é um
    // atalho: quem pede menos movimento não deveria ter que esperar seis
    // temporizadores para ler o argumento da seção.
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzir) {
      setVisiveis(FALAS.length);
      return;
    }

    // IntersectionObserver e não evento de scroll: dispara UMA vez, quando a
    // seção entra, e não fica pendurado no scroll — era isso que engasgava a
    // rolagem da página.
    const timers: ReturnType<typeof setTimeout>[] = [];
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        obs.disconnect();
        let atraso = 0;
        FALAS.forEach((f, i) => {
          // A Laura "digita" antes de responder; a cliente não.
          if (f.de === "laura") {
            timers.push(setTimeout(() => setDigitando(true), atraso));
            atraso += DIGITANDO;
          }
          timers.push(
            setTimeout(() => {
              setDigitando(false);
              setVisiveis(i + 1);
            }, atraso)
          );
          atraso += PAUSA;
        });
      },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  return (
    <div className="cv" ref={ref}>
      {FALAS.map((f, i) => {
        if (i >= visiveis) return null;
        return (
          <div key={i} className={`cv-linha cv-${f.de}`}>
            {/* A hora fica FORA da bolha, na margem, alinhada com a primeira e
                a última mensagem. É a distância entre as duas que vende. */}
            <span className="cv-hora">{f.hora ?? ""}</span>
            <div className="cv-balao">{f.texto}</div>
          </div>
        );
      })}
      {digitando && (
        <div className="cv-linha cv-laura">
          <span className="cv-hora" />
          <div className="cv-balao cv-digitando" aria-label="Laura digitando">
            <i />
            <i />
            <i />
          </div>
        </div>
      )}
    </div>
  );
}
