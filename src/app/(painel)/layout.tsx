import "../globals.css";
import { AppShell } from "@/components/app-shell";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeScript } from "@/components/theme-script";
import { TenantProvider } from "@/components/tenant-provider";
import { Toaster } from "@/components/ui/sonner";

// Chrome do CRM. Route group `(painel)` não aparece na URL: as rotas continuam
// sendo /, /clientes, /conversas, /agenda e /promocoes.
export default function PainelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <ThemeScript />
      <QueryProvider>
        <ThemeProvider>
          {/* TenantProvider por dentro do QueryProvider: a troca de clínica
              precisa poder invalidar o cache das telas. */}
          <TenantProvider>
            <AppShell>{children}</AppShell>
            <Toaster />
          </TenantProvider>
        </ThemeProvider>
      </QueryProvider>
    </>
  );
}
