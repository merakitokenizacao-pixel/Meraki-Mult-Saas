import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Entrar — VoraX",
  robots: { index: false, follow: false },
};

// Fora do route group (painel): não herda sidebar/topbar (não faria sentido
// mostrar a navegação para quem ainda não entrou).
export default function LoginPage() {
  return <LoginForm />;
}
