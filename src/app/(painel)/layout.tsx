import { AppShell } from "@/components/app-shell";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

// Chrome do CRM. Route group `(painel)` não aparece na URL: as rotas continuam
// sendo /, /clientes, /conversas, /agenda e /campanhas.
export default function PainelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <AppShell>{children}</AppShell>
        <Toaster />
      </ThemeProvider>
    </QueryProvider>
  );
}
