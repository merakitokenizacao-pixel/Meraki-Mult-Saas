"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, titleForPath } from "@/lib/nav";
import { useTheme } from "@/components/theme-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <div
        className={`sidebar-overlay${sidebarOpen ? " open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
      <div className="layout">
        <aside className={`sidebar${sidebarOpen ? " open" : ""}`} id="sidebar">
          <div className="sidebar-logo">
            <div className="logo-mark">
              Vora<em>X</em>
            </div>
          </div>
          <span className="nav-section">Principal</span>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${isActive(item.href) ? " active" : ""}`}
              >
                <Icon className="nav-icon" size={20} strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
          <div className="sidebar-footer">
            <div className="sidebar-status-dot" />
            <span className="sidebar-status-text">Laura ativa</span>
          </div>
        </aside>

        <main className="main">
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

          <div className="content">{children}</div>
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
