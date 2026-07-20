import {
  LayoutDashboard,
  Users,
  MessageCircle,
  CalendarDays,
  Send,
  Settings,
  type LucideIcon,
} from "lucide-react";

// Itens de navegação das 5 telas (paridade com a sidebar do legacy).
// Ícones de linha do lucide-react (line icons), traço fino.
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  title: string; // título exibido na topbar
};

export const NAV_ITEMS: NavItem[] = [
  // A raiz `/` é o SITE institucional — a Visão geral do painel vive em
  // /visao-geral desde que o site nasceu.
  {
    href: "/visao-geral",
    label: "Visão geral",
    icon: LayoutDashboard,
    title: "Visão geral",
  },
  { href: "/clientes", label: "Clientes", icon: Users, title: "Clientes" },
  { href: "/conversas", label: "Conversas", icon: MessageCircle, title: "Conversas" },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, title: "Agenda" },
  { href: "/campanhas", label: "Campanhas", icon: Send, title: "Campanhas" },
];

// Configurações fica no RODAPÉ da sidebar, separada das 5 telas de operação
// (é onde se ajusta o sistema, não onde se trabalha). Mesmo lugar do DataCraze.
export const SETTINGS_ITEM: NavItem = {
  href: "/configuracoes",
  label: "Configurações",
  icon: Settings,
  title: "Configurações",
};

const TODOS = [...NAV_ITEMS, SETTINGS_ITEM];

export function titleForPath(pathname: string): string {
  const exact = TODOS.find((i) => i.href === pathname);
  if (exact) return exact.title;
  const nested = TODOS.filter((i) => i.href !== "/").find((i) =>
    pathname.startsWith(i.href)
  );
  return nested?.title ?? "Visão geral";
}
