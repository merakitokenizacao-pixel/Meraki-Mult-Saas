// Helpers puros de formatação/apresentação — portados 1:1 do legacy.

// Iniciais (até 2) a partir do nome.
export function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Cores do avatar, como TOKENS e não como hex.
 *
 * Eram pares [escura, clarinha] cravados aqui, e o componente pintava o fundo
 * com a escura a 13% e o texto com a clarinha — 1,03 de contraste, invisível.
 * Hex fixo também não tinha como funcionar nos dois temas: a cor que lê no
 * branco some no #1a1814. O token resolve por tema; o fundo sai da própria
 * cor por color-mix, então nunca mais há um segundo valor para desencontrar.
 */
export const AVATAR_PALETTE: ReadonlyArray<string> = [
  "--mk-pessoa-1",
  "--mk-pessoa-2",
  "--mk-pessoa-3",
  "--mk-pessoa-4",
  "--mk-pessoa-5",
  "--mk-pessoa-6",
];

/** Sempre a mesma cor para o mesmo nome — a pessoa não muda de cor entre
 *  telas nem entre sessões. */
export function getAvatarColors(name?: string | null): string {
  const key = name || "?";
  return AVATAR_PALETTE[key.charCodeAt(0) % AVATAR_PALETTE.length];
}

// Data relativa curta: "Hoje, 14:30" · "Ontem, 09:10" · "12 mar".
export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  // Dia de calendário (não janela de 24h): "Hoje" = mesmo dia; "Ontem" = dia
  // anterior. Evita rotular como "Hoje" algo de ontem à noite ainda dentro de 24h.
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startD = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round(
    (startToday.getTime() - startD.getTime()) / 86400000
  );
  const time = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (dayDiff === 0) return "Hoje, " + time;
  if (dayDiff === 1) return "Ontem, " + time;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// Tempo relativo da última mensagem: "agora", "há 5 min", "há 2h", "ontem", "há 3d".
export function getRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d}d`;
  return fmtDate(dateStr);
}

// Normaliza o texto livre do serviço para um rótulo conhecido (ou 3 primeiras palavras).
const SERVICOS = [
  "Limpeza de pele",
  "Botox",
  "Peeling",
  "Drenagem linfatica",
  "Preenchimento",
  "Microagulhamento",
  "Depilacao a laser",
  "Hidratacao facial",
  "Radiofrequencia",
  "Criolipotise",
];
export function limparServico(texto?: string | null): string {
  if (!texto) return "—";
  const lower = texto.toLowerCase();
  const found = SERVICOS.find((s) => lower.includes(s.toLowerCase()));
  if (found) return found;
  return texto.replace(/\*/g, "").trim().split(" ").slice(0, 3).join(" ");
}

/**
 * Telefone brasileiro para leitura.
 *
 * O DDI sai da exibição: a clínica é de Brasília e 100% da base é +55, então
 * repetir o país em toda linha é ruído constante — e era ele que fazia a
 * coluna de telefone ocupar quase o dobro da largura na tabela.
 */
export function formatTelefone(tel?: string | null): string {
  if (!tel) return "—";
  const n = tel.replace(/\D/g, "");
  const semDDI = n.length >= 12 && n.startsWith("55") ? n.slice(2) : n;

  // 11 = DDD + celular de 9 dígitos. 10 = DDD + 8 dígitos (fixo, e celular
  // antigo, que o WhatsApp ainda entrega assim).
  //
  // O caso de 10 FALTAVA, e era um bug de verdade: 556181688257 tem 12 dígitos
  // (55 + 61 + oito), não casava com nenhum ramo e caía no `return tel`,
  // aparecendo cru na tela.
  if (semDDI.length === 11)
    return `(${semDDI.slice(0, 2)}) ${semDDI.slice(2, 7)}-${semDDI.slice(7)}`;
  if (semDDI.length === 10)
    return `(${semDDI.slice(0, 2)}) ${semDDI.slice(2, 6)}-${semDDI.slice(6)}`;
  // Sem DDD: formata ao menos o assinante, em vez de devolver o dígito cru.
  if (semDDI.length === 9) return `${semDDI.slice(0, 5)}-${semDDI.slice(5)}`;
  if (semDDI.length === 8) return `${semDDI.slice(0, 4)}-${semDDI.slice(4)}`;
  return tel;
}

// Nome do canal como marca, não como valor de banco. O n8n grava "whatsapp"
// em minúscula; escrever assim na tela é o mesmo que mostrar o enum cru.
const CANAIS: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  site: "Site",
  telefone: "Telefone",
  indicacao: "Indicação",
  presencial: "Presencial",
};

export function nomeCanal(canal?: string | null): string {
  const c = (canal ?? "whatsapp").trim().toLowerCase();
  // Canal novo que o n8n invente: capitaliza em vez de sumir com ele.
  return CANAIS[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
}

// Mapeia status → classe da badge.
//
// ⚠️ `faltou` ENTROU EM AGO/2026. Ele está no CHECK de `agendamentos` desde
// sempre (pendente, confirmado, realizado, faltou, cancelado) e não estava
// aqui: caía no fallback e saía com a cara de "novo". Um não-comparecimento
// pintado igual a um lead novo é o tipo de erro que ninguém nota, porque a
// badge aparece — só aparece errada.
const BADGE_CLASS: Record<string, string> = {
  novo: "badge-novo",
  agendado: "badge-agendado",
  convertido: "badge-convertido",
  cancelado: "badge-cancelado",
  realizado: "badge-realizado",
  faltou: "badge-faltou",
  confirmado: "badge-confirmado",
  pendente: "badge-pendente",
};
export function statusBadgeClass(status?: string | null): string {
  return BADGE_CLASS[status ?? ""] || "badge-novo";
}
