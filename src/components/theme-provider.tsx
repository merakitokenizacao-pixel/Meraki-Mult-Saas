"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  TEMA_PADRAO,
  TEMA_STORAGE_KEY,
  ehTema,
  modoDoTema,
  type Tema,
} from "@/lib/tema";

// Tema compartilhado por context. Escreve os dois atributos no <html>
// (data-mode + data-theme, ver lib/tema.ts) e persiste em localStorage.
// Os gráficos consomem este context só para re-renderizar e reler as CSS vars.

function aplicarNoDocumento(tema: Tema) {
  const el = document.documentElement;
  el.setAttribute("data-theme", tema);
  el.setAttribute("data-mode", modoDoTema(tema));
}

const ThemeContext = createContext<{
  theme: Tema;
  setTheme: (t: Tema) => void;
}>({
  theme: TEMA_PADRAO,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Começa no padrão e sincroniza no mount com o que o ThemeScript já pintou —
  // ler localStorage no primeiro render daria mismatch de hidratação.
  const [theme, setThemeState] = useState<Tema>(TEMA_PADRAO);

  useEffect(() => {
    const atual = document.documentElement.getAttribute("data-theme");
    if (ehTema(atual)) setThemeState(atual);
  }, []);

  const setTheme = useCallback((t: Tema) => {
    aplicarNoDocumento(t);
    try {
      localStorage.setItem(TEMA_STORAGE_KEY, t);
    } catch {}
    setThemeState(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
