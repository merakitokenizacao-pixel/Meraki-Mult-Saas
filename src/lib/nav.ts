import {
  LayoutDashboard,
  Users,
  MessageCircle,
  CalendarDays,
  Columns3,
  Settings,
  Undo2,
  type LucideIcon,
} from "lucide-react";

// A navegação principal é o que se olha TODO DIA: Visão geral, Clientes,
// Conversas, Agenda, Kanban.
//
// ⚠️ Promoções SAIU daqui em ago/2026 e virou sub-item de Configurações.
// Promoção se configura de vez em quando e depois se esquece — ocupar espaço
// permanente numa lista curta é o que empurra as telas de operação para baixo.
// Mesmo critério de Requisitos e Envios automáticos.
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
  // Mesma matéria da Agenda, outra pergunta: a Agenda responde "quando", o
  // Kanban responde "em que pé está". Fica ao lado dela de propósito.
  { href: "/kanban", label: "Kanban", icon: Columns3, title: "Kanban" },
  { href: "/follow-ups", label: "Follow-ups", icon: Undo2, title: "Follow-ups" },
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
