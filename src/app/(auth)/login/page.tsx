import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Entrar — Meraki",
  robots: { index: false, follow: false },
};

// Fora do route group (painel): não herda sidebar/topbar (não faria sentido
// mostrar a navegação para quem ainda não entrou).
//
// O <Suspense> é OBRIGATÓRIO: o LoginForm usa useSearchParams() para ler o
// ?proximo=, e sem a fronteira o Next não consegue pré-renderizar esta página
// (o build quebra em "missing-suspense-with-csr-bailout").
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-mk-fundo" />}>
      <LoginForm />
    </Suspense>
  );
}
