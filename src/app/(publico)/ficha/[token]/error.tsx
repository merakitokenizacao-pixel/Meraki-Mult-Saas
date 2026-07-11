"use client";

import { RotateCw } from "lucide-react";
import { Card, FichaShell } from "@/components/ficha/ficha-shell";

// Barreira de erro da rota pública: se algo inesperado quebrar no servidor, a
// paciente vê uma tela acolhedora (com a marca da clínica) e um botão de tentar
// de novo — nunca a página de erro crua do Next. Sem detalhe técnico.
export default function ErroFicha({ reset }: { error: Error; reset: () => void }) {
  return (
    <FichaShell>
      <Card>
        <div className="flex flex-col items-center text-center">
          <h2 className="font-[family-name:var(--font-cormorant)] text-[24px] font-medium text-[var(--f-text)]">
            Algo deu errado
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--f-text2)]">
            Tivemos um probleminha ao abrir sua ficha. Tente novamente em
            instantes.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[var(--f-accent)] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[var(--f-accent-dark)]"
          >
            <RotateCw size={17} strokeWidth={1.8} />
            Tentar de novo
          </button>
          <p className="mt-6 text-[13px] leading-relaxed text-[var(--f-muted)]">
            Se continuar, fale com a gente pelo WhatsApp.
          </p>
        </div>
      </Card>
    </FichaShell>
  );
}
