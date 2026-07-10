"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { NAV_ITEMS, titleForPath } from "@/lib/nav";
import { useTheme } from "@/components/theme-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Inicia colapsada já no primeiro paint quando a rota for /conversas (sem flash)
  const [collapsed, setCollapsed] = useState(() =>
    pathname.startsWith("/conversas")
  );
  const [currentDate, setCurrentDate] = useState("");

  // Data na topbar — mesmo formato do legacy
  useEffect(() => {
    setCurrentDate(
      new Date().toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    );
  }, []);

  // Fecha o menu mobile ao trocar de rota
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Ao entrar em /conversas a sidebar entra colapsada (vira o "nav rail" do
  // redesign); o toggle continua disponível para expandir se o usuário quiser.
  useEffect(() => {
    if (pathname.startsWith("/conversas")) setCollapsed(true);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const isConversas = pathname.startsWith("/conversas");

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
                "V"
              ) : (
                <>
                  Vora<em>X</em>
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
          <span className="nav-section">Principal</span>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${isActive(item.href) ? " active" : ""}`}
                aria-label={item.label}
                data-label={item.label}
              >
                <Icon className="nav-icon" size={20} strokeWidth={1.5} />
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
          <div className="sidebar-footer">
            <div className="sidebar-status-dot" />
            <span className="sidebar-status-text">Laura ativa</span>
          </div>
        </aside>

        <main className="main">
          {/* Em /conversas a tela é inteira: sem topbar (título, data e tema) */}
          {!isConversas && (
            <div className="topbar">
              <div className="topbar-left">
                <button
                  className="hamburger"
                  onClick={() => setSidebarOpen((o) => !o)}
                  aria-label="Menu"
                >
                  ☰
                </button>
                <span className="topbar-title">{titleForPath(pathname)}</span>
              </div>
              <div className="topbar-right">
                <span className="topbar-date">{currentDate}</span>
                <button
                  className="theme-toggle"
                  onClick={toggleTheme}
                  title="Alternar tema"
                >
                  {theme === "dark" ? "☀" : "☽"}
                </button>
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
