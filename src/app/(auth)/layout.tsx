import "../globals.css";
import { ThemeScript } from "@/components/theme-script";

// Rotas de autenticação. Não herdam o chrome do CRM (sidebar/topbar/providers)
// — quem não entrou não tem o que navegar. Mas herdam o CSS e o tema, porque
// a tela de login é do CRM. Ver `(painel)/layout.tsx` e `(site)/layout.tsx`.
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <ThemeScript />
      {children}
    </>
  );
}
