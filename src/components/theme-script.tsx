import { TEMAS, TEMA_STORAGE_KEY } from "@/lib/tema";

// Aplica o tema salvo ANTES da pintura, evitando o flash claro→escuro.
// Fica só nos route groups do CRM: a landing e a ficha da paciente têm paleta
// própria e não podem ser afetadas pelo tema que a dona salvou no navegador.
//
// O mapa id→modo é gerado do catálogo (lib/tema.ts) para não haver drift: tema
// novo lá aparece aqui sozinho. Valor desconhecido no localStorage = não faz
// nada, e o :root (claro) prevalece.
const MODOS = JSON.stringify(
  Object.fromEntries(TEMAS.map((t) => [t.id, t.escuro ? "dark" : "light"]))
);

const themeScript = `(function(){try{var M=${MODOS};var t=localStorage.getItem('${TEMA_STORAGE_KEY}');var m=M[t];if(!m)return;var d=document.documentElement;d.setAttribute('data-theme',t);d.setAttribute('data-mode',m);}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
