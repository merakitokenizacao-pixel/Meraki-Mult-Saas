import type { Metadata } from "next";
import { CLINICA, clinicaCssVars } from "@/lib/clinica";

// Metadados neutros: sem "VoraX", sem indexação.
export const metadata: Metadata = {
  title: `Ficha de avaliação — ${CLINICA.nomeCurto}`,
  description: "Formulário de avaliação pré-procedimento.",
  robots: { index: false, follow: false, nocache: true },
};

// Rotas abertas a pacientes. Não herdam sidebar, topbar, tema, React Query,
// toaster — nada do painel. Ver `(painel)/layout.tsx`.
export default function PublicoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="ficha-root" style={clinicaCssVars()}>
      {children}
    </div>
  );
}
