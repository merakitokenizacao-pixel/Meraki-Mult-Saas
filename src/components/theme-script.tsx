// Aplica o tema salvo ANTES da pintura, evitando o flash branco→escuro.
// Fica só nos route groups do CRM: a landing e a ficha da paciente têm paleta
// própria e não podem ser afetadas pelo tema que a dona salvou no navegador.
const themeScript = `(function(){try{var t=localStorage.getItem('vorax-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
