// Itens de navegação das 5 telas (paridade com a sidebar do legacy)
export type NavItem = {
  href: string;
  label: string;
  icon: string; // glifo unicode usado no legacy
  title: string; // título exibido na topbar
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Visão geral", icon: "◇", title: "Visão geral" },
  { href: "/clientes", label: "Clientes", icon: "◉", title: "Clientes" },
  { href: "/conversas", label: "Conversas", icon: "◎", title: "Conversas" },
  { href: "/agenda", label: "Agenda", icon: "◗", title: "Agenda" },
  { href: "/campanhas", label: "Campanhas", icon: "✉", title: "Campanhas" },
];

export function titleForPath(pathname: string): string {
  const exact = NAV_ITEMS.find((i) => i.href === pathname);
  if (exact) return exact.title;
  const nested = NAV_ITEMS.filter((i) => i.href !== "/").find((i) =>
    pathname.startsWith(i.href)
  );
  return nested?.title ?? "Visão geral";
}
