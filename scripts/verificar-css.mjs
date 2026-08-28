// Conferência de sanidade do globals.css.
//
// ⚠️ POR QUE ISTO EXISTE: `next build` imprime "Invalid empty selector" e sai
// com código 0. Medido. O exit code, que é a régua que o CLAUDE.md manda usar,
// NÃO cobre erro de CSS — um seletor quebrado passa pelo build e só aparece
// quando alguém abre a tela no `next dev`.
//
// Foi assim que um seletor vazio (` {`, sobra de um prefixo removido por
// script) entrou no repositório com o build verde.
//
// Roda com: node scripts/verificar-css.mjs
import { readFileSync } from "node:fs";

const ARQUIVOS = ["src/app/globals.css", "src/app/(site)/site.css"];
const problemas = [];

for (const arquivo of ARQUIVOS) {
  const linhas = readFileSync(arquivo, "utf8").split("\n");

  // fora de comentário, para não acusar exemplo escrito em prosa
  let emComentario = false;
  let chaves = 0;

  linhas.forEach((linha, i) => {
    const n = i + 1;
    let texto = linha;

    if (emComentario) {
      const fim = texto.indexOf("*/");
      if (fim === -1) return;
      texto = texto.slice(fim + 2);
      emComentario = false;
    }
    texto = texto.replace(/\/\*.*?\*\//g, "");
    const abre = texto.indexOf("/*");
    if (abre !== -1) {
      texto = texto.slice(0, abre);
      emComentario = true;
    }

    const t = texto.trim();
    if (!t) return;

    // seletor vazio: a linha é só `{`
    if (t === "{") {
      problemas.push(`${arquivo}:${n}  seletor VAZIO — "{" sem nada antes`);
    }
    // seletor que começa com combinador solto
    if (/^[>+~,]/.test(t)) {
      problemas.push(`${arquivo}:${n}  seletor começa com "${t[0]}" — sobra de prefixo removido?`);
    }
    // declaração sem valor
    if (/^[a-z-]+:\s*;/.test(t)) {
      problemas.push(`${arquivo}:${n}  declaração sem valor — ${t}`);
    }
    // (Sem checagem de parênteses: valor multilinha — um `linear-gradient`
    // quebrado em várias linhas — torna a conta por linha inútil, e não é essa
    // a classe de defeito que este script existe para pegar.)

    chaves += (texto.match(/\{/g) || []).length;
    chaves -= (texto.match(/\}/g) || []).length;
  });

  if (chaves !== 0) {
    problemas.push(`${arquivo}  chaves desbalanceadas: ${chaves > 0 ? chaves + " a mais" : -chaves + " a menos"}`);
  }
}

if (problemas.length) {
  console.error("CSS com problema:\n");
  for (const p of problemas) console.error("  " + p);
  process.exit(1);
}
console.log("CSS ok: sem seletor vazio, combinador solto ou chave desbalanceada");
