// Catálogo dos temas do painel — fonte única.
//
// O <html> carrega DOIS atributos, de propósito:
//   data-mode="light|dark"   → o que é estrutural (contraste, sombras, o
//                              variant `dark:` do Tailwind)
//   data-theme="<id>"        → qual PALETA está em uso
// Separar os dois é o que permite existir mais de um tema escuro sem reescrever
// nenhuma regra de CSS: um tema novo só declara seus tokens `--vx-*`.
//
// Os ids são os mesmos valores já gravados no localStorage ('light'/'dark'),
// então quem já tinha preferência salva não perde nada.

export type Tema = "light" | "dark" | "graphite";
export type Modo = "light" | "dark";

export const TEMA_PADRAO: Tema = "light";
export const TEMA_STORAGE_KEY = "vorax-theme";

/** Amostra usada na miniatura do seletor (Configurações → Aparência). */
export interface PreviaTema {
  bg: string;
  surface: string;
  border: string;
  text: string;
  accent: string;
  /** Cores funcionais: verde, âmbar, vermelho, azul. É o que diferencia os temas. */
  cores: [string, string, string, string];
}

export interface DefTema {
  id: Tema;
  label: string;
  descricao: string;
  escuro: boolean;
  previa: PreviaTema;
}

// As cores da prévia são LITERAIS (não var(--vx-*)): o cartão precisa mostrar o
// tema que NÃO está aplicado. Devem espelhar os blocos de token do globals.css.
export const TEMAS: DefTema[] = [
  {
    id: "light",
    label: "Claro",
    descricao: "Bege e dourado, para o dia",
    escuro: false,
    previa: {
      bg: "#f8f6f2",
      surface: "#ffffff",
      border: "#e0dbd2",
      text: "#1a1814",
      accent: "#9b7d5a",
      cores: ["#3a6b4f", "#b5600a", "#b03030", "#2a5278"],
    },
  },
  {
    id: "dark",
    label: "Escuro",
    descricao: "O mesmo bege, em tom de noite",
    escuro: true,
    previa: {
      bg: "#111009",
      surface: "#1a1814",
      border: "#38352a",
      text: "#f0ece4",
      accent: "#c8a07a",
      cores: ["#5ab87a", "#e89040", "#e05050", "#60a0d0"],
    },
  },
  {
    id: "graphite",
    label: "Grafite",
    descricao: "Preto neutro; o dourado e os status ganham força",
    escuro: true,
    previa: {
      bg: "#0a0a0c",
      surface: "#131316",
      border: "#26262c",
      text: "#f4f4f5",
      accent: "#d4ac72",
      cores: ["#3ecf8e", "#f0a83c", "#f2565c", "#5aa2f5"],
    },
  },
];

export function ehTema(v: unknown): v is Tema {
  return typeof v === "string" && TEMAS.some((t) => t.id === v);
}

export function defDoTema(id: Tema): DefTema {
  return TEMAS.find((t) => t.id === id) ?? TEMAS[0];
}

export function modoDoTema(id: Tema): Modo {
  return defDoTema(id).escuro ? "dark" : "light";
}
