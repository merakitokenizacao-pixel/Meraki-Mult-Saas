// Identidade da clínica exibida nas páginas PÚBLICAS (a paciente nunca vê a
// marca VoraX). Hoje é constante; quando o CRM virar multi-clínica, basta
// carregar este objeto por tenant — nenhum componente conhece a LINS por nome.
export const CLINICA = {
  nome: "LINS Estética Avançada",
  nomeCurto: "LINS Estética",
  // Paleta FIXA, de propósito: a ficha não pode seguir o tema (claro/escuro)
  // do painel, então ela não usa os tokens --vx-*.
  cores: {
    bg: "#faf8f4",
    surface: "#ffffff",
    text: "#1f1c17",
    text2: "#57524a",
    muted: "#8b857a",
    border: "#e6e1d8",
    accent: "#9b7d5a",
    accentDark: "#7a6244",
    accentLight: "#f5ede0",
    danger: "#a3342a",
  },
} as const;

// Injetado como CSS vars no wrapper da página pública (ver (publico)/layout.tsx).
export function clinicaCssVars(): React.CSSProperties {
  const c = CLINICA.cores;
  return {
    "--f-bg": c.bg,
    "--f-surface": c.surface,
    "--f-text": c.text,
    "--f-text2": c.text2,
    "--f-muted": c.muted,
    "--f-border": c.border,
    "--f-accent": c.accent,
    "--f-accent-dark": c.accentDark,
    "--f-accent-light": c.accentLight,
    "--f-danger": c.danger,
  } as React.CSSProperties;
}
