// Catálogo de aparência do painel — fonte única.
//
// ⚠️ MUDOU EM AGO/2026, junto com o sistema visual. Antes eram três paletas
// (clara, escura, grafite) sobre um mesmo conjunto de regras: `data-mode`
// dizia o estrutural (contraste, o variant `dark:` do Tailwind) e `data-theme`
// dizia a paleta. Trocar de paleta não mexia em regra nenhuma.
//
// O sistema Meraki não é uma paleta a mais: é uma ESCADA de camadas sobre uma
// base quase preta (`#ffffff07` sobre `#0e0f11`). Isso não tem versão clara —
// 3% de branco sobre branco não é superfície, é nada. As regras que separam
// por borda de 1px também dependem do fundo escuro para existir.
//
// Então o catálogo tem uma entrada só, e os dois atributos continuam sendo
// estampados porque o `dark:` do Tailwind e o toast do sonner leem `data-mode`.
// A estrutura fica de pé para o dia em que houver um segundo sistema; hoje
// declarar dois seria mentir sobre uma escolha que não existe.

export type Tema = "meraki";
export type Modo = "light" | "dark";

export const TEMA_PADRAO: Tema = "meraki";
export const TEMA_STORAGE_KEY = "meraki-theme";

/** Amostra usada na miniatura (Configurações → Aparência). */
export interface PreviaTema {
  bg: string;
  surface: string;
  border: string;
  text: string;
  accent: string;
  /** Cores funcionais: ativa, aviso, alerta, pausada. */
  cores: [string, string, string, string];
}

export interface DefTema {
  id: Tema;
  label: string;
  descricao: string;
  escuro: boolean;
  previa: PreviaTema;
}

// As cores da prévia são LITERAIS de propósito: a miniatura tem que se pintar
// sozinha, sem depender dos tokens que ela está ilustrando. Devem espelhar o
// bloco de tokens do globals.css — se um mudar lá, muda aqui.
export const TEMAS: DefTema[] = [
  {
    id: "meraki",
    label: "Meraki",
    descricao: "Base quase preta, superfície translúcida, acento violeta",
    escuro: true,
    previa: {
      // ⚠️ ESTES TRÊS ESPELHAM O BLOCO DE TOKENS e são recompostos toda vez
      // que a base muda — ver "A escada" no globals.css. Já ficaram para trás
      // uma vez: a miniatura continuou mostrando #0e0f11 depois de a base
      // subir, ou seja, ilustrando um sistema que não existia mais.
      bg: "#1e1f21",
      // Translúcidos no CSS, COMPOSTOS aqui: --mk-superficie (#ffffff07) e
      // --mk-linha (#ffffff30), os dois sobre a base acima.
      surface: "#242527",
      border: "#48494b",
      text: "#ecedee",
      accent: "#a78bfa",
      cores: ["#3fb950", "#d9a441", "#f85149", "#7dd3fc"],
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
