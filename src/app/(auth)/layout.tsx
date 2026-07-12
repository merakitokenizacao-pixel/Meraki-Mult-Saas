// Rotas de autenticação. Não herdam o chrome do CRM (sidebar/topbar/providers)
// — quem não entrou não tem o que navegar. Ver `(painel)/layout.tsx`.
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
