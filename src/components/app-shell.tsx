"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { NAV_ITEMS, SETTINGS_ITEM, titleForPath } from "@/lib/nav";
import { LogoutButton } from "@/components/auth/logout-button";
import { TenantSelector } from "@/components/tenant-selector";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Inicia colapsada já no primeiro paint quando a rota for /conversas (sem flash)
  const [collapsed, setCollapsed] = useState(() =>
    pathname.startsWith("/conversas")
  );

  // Fecha o menu mobile ao trocar de rota
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Ao entrar em /conversas a sidebar entra colapsada (vira o "nav rail" do
  // redesign); o toggle continua disponível para expandir se o usuário quiser.
  useEffect(() => {
    if (pathname.startsWith("/conversas")) setCollapsed(true);
  }, [pathname]);

  // Nenhum item aponta mais para a raiz (ela é o site institucional), então
  // basta o prefixo.
  const isActive = (href: string) => pathname.startsWith(href);

  const isConversas = pathname.startsWith("/conversas");
  // A topbar só repetia o título que a própria tela já mostra, e custava 64px
  // antes do primeiro número. Some no desktop; no mobile fica, porque carrega
  // o hambúrguer.
  const semTopbar =
    pathname.startsWith("/visao-geral") ||
    pathname.startsWith("/configuracoes") ||
    // O Kanban tem H1 próprio: com a topbar, "Kanban" aparecia duas vezes na
    // mesma tela. E os 64px dela saem do quadro, que precisa de altura.
    pathname.startsWith("/kanban");

  return (
    <>
      <div
        className={`sidebar-overlay${sidebarOpen ? " open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
      <div className={`layout${collapsed ? " collapsed" : ""}`}>
        <aside className={`sidebar${sidebarOpen ? " open" : ""}`} id="sidebar">
          <div className="sidebar-logo">
            <div className="logo-mark">
              {collapsed ? (
                "M"
              ) : (
                <>
                  Merak<em>i</em>
                </>
              )}
            </div>
            <button
              className="sidebar-toggle"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? (
                <ChevronsRight size={16} strokeWidth={2} />
              ) : (
                <ChevronsLeft size={16} strokeWidth={2} />
              )}
            </button>
          </div>
          {/* Sem "PRINCIPAL". A separação entre operação e sistema vem da
              POSIÇÃO: este bloco cresce e empurra o rodapé para baixo. Um
              rótulo de seção em dourado disputava com o único dourado que
              precisa significar alguma coisa aqui — "você está aqui". */}
          <TenantSelector collapsed={collapsed} />

        <nav className="sidebar-nav">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item${isActive(item.href) ? " active" : ""}`}
                  aria-label={item.label}
                  data-label={item.label}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  <Icon className="nav-icon" size={16} strokeWidth={2} />
                  <span className="nav-label">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-rodape">
            {/* O status da Laura era um enfeite: dizia "ativa" sempre,
                inclusive com o WhatsApp caído. Agora leva para a tela que
                responde de verdade se ela está atendendo. */}
            <Link
              href="/configuracoes"
              className="sidebar-footer"
              aria-label="Status da Laura"
              data-label="Laura"
            >
              <span className="sidebar-status-dot" />
              <span className="sidebar-status-text">Laura ativa</span>
            </Link>
            <Link
              href={SETTINGS_ITEM.href}
              className={`nav-item nav-item-footer${
                isActive(SETTINGS_ITEM.href) ? " active" : ""
              }`}
              aria-label={SETTINGS_ITEM.label}
              data-label={SETTINGS_ITEM.label}
              aria-current={isActive(SETTINGS_ITEM.href) ? "page" : undefined}
            >
              <SETTINGS_ITEM.icon className="nav-icon" size={16} strokeWidth={2} />
              <span className="nav-label">{SETTINGS_ITEM.label}</span>
            </Link>
            <LogoutButton collapsed={collapsed} />
          </div>
        </aside>

        <main className="main">
          {/* Em /conversas a tela é inteira: sem topbar.
              A data e o toggle de tema saíram da topbar — o tema agora mora em
              Configurações → Aparência, e a data não valia o espaço que ocupava.
              Sobra só o título (e o hambúrguer no mobile). */}
          {!isConversas && (
            <div className={`topbar${semTopbar ? " topbar-so-mobile" : ""}`}>
              <div className="topbar-left">
                <button
                  className="hamburger"
                  onClick={() => setSidebarOpen((o) => !o)}
                  aria-label="Menu"
                >
                  ☰
                </button>
                {!semTopbar && (
                  <span className="topbar-title">{titleForPath(pathname)}</span>
                )}
              </div>
            </div>
          )}

          <div className={`content${isConversas ? " content-flush" : ""}`}>
            {children}
          </div>
        </main>
      </div>

      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`bottom-nav-item${isActive(item.href) ? " active" : ""}`}
              >
                <Icon className="bn-icon" size={20} strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
