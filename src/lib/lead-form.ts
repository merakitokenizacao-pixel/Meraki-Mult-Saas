// Validação e normalização do cadastro de lead. Lógica pura, sem I/O.
//
// Regra da casa: o que vai para o banco é NORMALIZADO (só dígitos em telefone,
// documento e CEP); a formatação bonita é da tela. Guardar "(61) 99999-8888"
// quebraria o upsert por telefone que o n8n faz, que usa dígitos com DDI.

export interface CamposLead {
  nome: string;
  telefone: string;
  email: string;
  site: string;
  documento: string;
  empresa: string;
  anuncio_origem: string;
  nascimento: string; // YYYY-MM-DD
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  anotacoes: string;
  etiquetas: string[];
}

export function camposVazios(): CamposLead {
  return {
    nome: "",
    telefone: "",
    email: "",
    site: "",
    documento: "",
    empresa: "",
    anuncio_origem: "",
    nascimento: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    anotacoes: "",
    etiquetas: [],
  };
}

export const soDigitos = (s: string): string => (s || "").replace(/\D/g, "");

// ── Telefone ────────────────────────────────────────────────────────────────
/** Dígitos com DDI 55 — o formato que o n8n usa como chave de upsert. Sem
 *  isso, o lead cadastrado à mão vira um SEGUNDO registro quando a pessoa
 *  manda WhatsApp. */
export function normalizarTelefone(bruto: string): string {
  const d = soDigitos(bruto);
  if (!d) return "";
  return d.startsWith("55") ? d : `55${d}`;
}

export function telefoneValido(bruto: string): boolean {
  const d = normalizarTelefone(bruto);
  // 55 + DDD(2) + número(8 ou 9)
  return d.length === 12 || d.length === 13;
}

export function formatarTelefone(bruto: string): string {
  const d = normalizarTelefone(bruto).replace(/^55/, "");
  if (d.length <= 2) return d;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = resto.length > 8 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte, corte + 4)}`;
}

// ── Documento ───────────────────────────────────────────────────────────────
/** Dígito verificador de CPF. Rejeita os repetidos (111.111.111-11), que
 *  passam na conta mas não existem. */
function cpfValido(d: string): boolean {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const [ate, pos] of [
    [9, 10],
    [10, 11],
  ] as const) {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (pos - i);
    const dv = (soma * 10) % 11 % 10;
    if (dv !== Number(d[ate])) return false;
  }
  return true;
}

function cnpjValido(d: string): boolean {
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (ate: number) => {
    const pesos =
      ate === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * pesos[i];
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export function documentoValido(bruto: string): boolean {
  const d = soDigitos(bruto);
  if (!d) return true; // opcional
  if (d.length === 11) return cpfValido(d);
  if (d.length === 14) return cnpjValido(d);
  return false;
}

export function formatarDocumento(bruto: string): string {
  const d = soDigitos(bruto).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

// ── Outros ──────────────────────────────────────────────────────────────────
/** Checagem de forma, não de existência: só rejeita o que claramente não é
 *  e-mail. Validar mais que isso rejeita endereço legítimo. */
export function emailValido(v: string): boolean {
  const s = (v || "").trim();
  if (!s) return true; // opcional
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export function cepValido(v: string): boolean {
  const d = soDigitos(v);
  return d.length === 0 || d.length === 8;
}

export function formatarCep(v: string): string {
  const d = soDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Nascimento no passado e plausível. Compara em TEXTO, sem `new Date`: a data
 *  "1990-05-14" interpretada como UTC vira 13/05 em Brasília. */
export function nascimentoValido(v: string, hoje = new Date()): boolean {
  const s = (v || "").trim();
  if (!s) return true; // opcional
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const ano = Number(m[1]);
  if (ano < 1900) return false;
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  return s <= hojeISO;
}

export function siteNormalizado(v: string): string {
  const s = (v || "").trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

// ── Validação do formulário ─────────────────────────────────────────────────
export type ErrosLead = Partial<Record<keyof CamposLead, string>>;

export function validarLead(c: CamposLead, hoje = new Date()): ErrosLead {
  const e: ErrosLead = {};
  if (!c.nome.trim()) e.nome = "Informe o nome";
  if (!c.telefone.trim()) e.telefone = "Informe o telefone";
  else if (!telefoneValido(c.telefone)) e.telefone = "Telefone incompleto";
  if (!emailValido(c.email)) e.email = "E-mail inválido";
  if (!documentoValido(c.documento)) e.documento = "CPF ou CNPJ inválido";
  if (!cepValido(c.cep)) e.cep = "CEP deve ter 8 dígitos";
  if (!nascimentoValido(c.nascimento, hoje)) e.nascimento = "Data inválida";
  if (c.uf && c.uf.trim().length !== 2) e.uf = "UF tem 2 letras";
  return e;
}

/** Qual aba mostrar quando o salvar falha — abrir a errada faz o usuário
 *  caçar um erro que está escondido em outra. */
export const ABA_DO_CAMPO: Partial<Record<keyof CamposLead, string>> = {
  telefone: "contato",
  email: "contato",
  site: "contato",
  documento: "dados",
  empresa: "dados",
  nascimento: "dados",
  cep: "endereco",
  uf: "endereco",
};

/** Campos → linha da tabela. Vazio vira NULL: string vazia em coluna opcional
 *  atrapalha filtro e conta como preenchida. */
export function paraLinha(c: CamposLead): Record<string, unknown> {
  const opc = (s: string) => {
    const v = (s || "").trim();
    return v.length > 0 ? v : null;
  };
  return {
    nome: c.nome.trim(),
    telefone: normalizarTelefone(c.telefone),
    canal: "manual",
    status: "novo",
    email: opc(c.email)?.toLowerCase() ?? null,
    site: c.site.trim() ? siteNormalizado(c.site) : null,
    documento: soDigitos(c.documento) || null,
    empresa: opc(c.empresa),
    anuncio_origem: opc(c.anuncio_origem),
    nascimento: opc(c.nascimento),
    cep: soDigitos(c.cep) || null,
    logradouro: opc(c.logradouro),
    numero: opc(c.numero),
    complemento: opc(c.complemento),
    bairro: opc(c.bairro),
    cidade: opc(c.cidade),
    uf: c.uf.trim() ? c.uf.trim().toUpperCase() : null,
    anotacoes: opc(c.anotacoes),
    etiquetas: c.etiquetas.length > 0 ? c.etiquetas : null,
  };
}
