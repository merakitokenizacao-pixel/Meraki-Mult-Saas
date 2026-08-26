import { CLINICA } from "@/lib/clinica";

// Moldura de toda página pública: marca da CLÍNICA, nunca do Meraki.
export function FichaShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col px-4 pb-12 pt-8 sm:px-6 sm:pt-12">
      <header className="mb-8 text-center">
        <h1 className="font-[family-name:var(--font-cormorant)] text-[26px] font-medium leading-tight tracking-wide text-[var(--f-text)] sm:text-[30px]">
          {CLINICA.nome}
        </h1>
        <div className="mx-auto mt-4 h-px w-12 bg-[var(--f-accent)] opacity-40" />
      </header>
      {children}
    </div>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--f-border)] bg-[var(--f-surface)] p-6 shadow-[0_1px_3px_rgba(31,28,23,0.04),0_8px_24px_-12px_rgba(31,28,23,0.10)] sm:p-8">
      {children}
    </div>
  );
}
