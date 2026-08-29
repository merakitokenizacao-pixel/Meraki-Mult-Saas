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
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

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

const RE_COMENTARIO = /\/\*[\s\S]*?\*\//g;
const RE_CLASSE = /\.([A-Za-z][\w-]*)/g;
const RE_TSX = /\.tsx?$/;
const RE_CLASSNAME = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;
// `${...}` inteiro sai antes de partir: senao o IDENTIFICADOR de dentro
// (`sidebarOpen`) entra como se fosse nome de classe.
const RE_EXPR = /\$\{[^}]*\}/g;
const RE_SEP = /[\s`${}?:()+]+/;
const RE_NOME = /^[A-Za-z][\w-]*$/;
const SEP_WIN = "\\";

// -----------------------------------------------------------------------
// Classe NOMEADA sem regra.
//
// ⚠️ Este defeito também passa por build e por teste: o elemento simplesmente
// renderiza sem estilo. Já foram três (`.metrics-lente`, `.nav-item-footer`,
// `.drp-mes`) e um player de áudio foi para produção assim. A conferência
// manual não pega — por isso ela virou esta.
//
// Só as classes da CASA entram: utilitário do Tailwind não mora no CSS.
const PREFIXOS = [
  "neg-", "nav-", "vg-", "mk-", "seg", "metric", "drp-", "mtz-", "funnel-",
  "conv-", "badge", "kb-",
  "ag-", "escala-", "prof-", "fu-", "lead-", "midia-", "agenda-", "msg-",
  "modal-", "conexao-", "table-", "date-filter", "sidebar", "topbar", "card",
  "empty", "spinner", "page-",
];

// Classe sem regra que É correta assim. Cada uma precisa de motivo.
const TOLERADAS = new Map([
  // Wrapper de um dia na lista da Agenda. Fica sem regra DE PROPÓSITO: é ele
  // o bloco-container de `.ag-lista-dia-cab`, que é `position: sticky`. Como
  // bloco simples, cada cabeçalho gruda enquanto o dia dele está à vista e é
  // empurrado pelo próximo. Qualquer regra que criasse contexto novo aqui
  // quebraria isso.
  ["ag-lista-dia", "containing block do cabecalho sticky"],
]);

const regras = new Set();
for (const arquivo of ARQUIVOS) {
  const semComentario = readFileSync(arquivo, "utf8").replace(RE_COMENTARIO, "");
  for (const m of semComentario.matchAll(RE_CLASSE)) regras.add(m[1]);
}

const usadas = new Map();
function varrer(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const cam = join(dir, e.name);
    if (e.isDirectory()) { varrer(cam); continue; }
    if (!RE_TSX.test(e.name)) continue;
    for (const m of readFileSync(cam, "utf8").matchAll(RE_CLASSNAME)) {
      for (const tok of (m[1] ?? m[2]).replace(RE_EXPR, " ").split(RE_SEP)) {
        if (!RE_NOME.test(tok)) continue;
        if (!PREFIXOS.some((p) => tok.startsWith(p))) continue;
        // `neg-tom-${...}` deixa o prefixo solto: nome montado por string nao
        // da para conferir aqui. Os tres lugares que fazem isso estao listados
        // no CLAUDE.md.
        if (tok.endsWith("-")) continue;
        if (!usadas.has(tok)) usadas.set(tok, new Set());
        usadas.get(tok).add(cam.split(SEP_WIN).join("/"));
      }
    }
  }
}
varrer("src");

for (const [classe, arquivos] of usadas) {
  if (regras.has(classe) || TOLERADAS.has(classe)) continue;
  problemas.push(`.${classe}  usada em ${[...arquivos].join(", ")} — sem regra no CSS`);
}

if (problemas.length) {
  console.error("CSS com problema:\n");
  for (const p of problemas) console.error("  " + p);
  process.exit(1);
}
console.log(
  "CSS ok: sem seletor vazio, combinador solto ou chave desbalanceada; " +
    `${usadas.size} classes da casa, todas com regra` +
    (TOLERADAS.size ? ` (${TOLERADAS.size} tolerada por motivo documentado)` : "")
);
