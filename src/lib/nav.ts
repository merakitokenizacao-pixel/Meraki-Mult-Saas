import {
  LayoutDashboard,
  Users,
  MessageCircle,
  CalendarDays,
  Send,
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
  { href: "/", label: "Visão geral", icon: LayoutDashboard, title: "Visão geral" },
  { href: "/clientes", label: "Clientes", icon: Users, title: "Clientes" },
  { href: "/conversas", label: "Conversas", icon: MessageCircle, title: "Conversas" },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, title: "Agenda" },
  { href: "/campanhas", label: "Campanhas", icon: Send, title: "Campanhas" },
];

export function titleForPath(pathname: string): string {
  const exact = NAV_ITEMS.find((i) => i.href === pathname);
  if (exact) return exact.title;
  const nested = NAV_ITEMS.filter((i) => i.href !== "/").find((i) =>
    pathname.startsWith(i.href)
  );
  return nested?.title ?? "Visão geral";
}
