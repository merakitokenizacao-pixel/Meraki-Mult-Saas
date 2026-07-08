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

// Paleta determinística de cores de avatar (fundo, texto).
export const AVATAR_PALETTE: ReadonlyArray<readonly [string, string]> = [
  ["#8b5e3c", "#f5ede5"],
  ["#2d6a4f", "#d8f3dc"],
  ["#1a5276", "#e8f0fb"],
  ["#6c5ce7", "#f0edff"],
  ["#c0392b", "#fde8e8"],
  ["#b5540a", "#fef3e2"],
];

export function getAvatarColors(name?: string | null): readonly [string, string] {
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

// Formata telefone BR (13 dígitos com DDI, 11 sem DDI).
export function formatTelefone(tel?: string | null): string {
  if (!tel) return "—";
  const n = tel.replace(/\D/g, "");
  if (n.length === 13)
    return (
      "+" +
      n.slice(0, 2) +
      " (" +
      n.slice(2, 4) +
      ") " +
      n.slice(4, 9) +
      "-" +
      n.slice(9)
    );
  if (n.length === 11)
    return "(" + n.slice(0, 2) + ") " + n.slice(2, 7) + "-" + n.slice(7);
  return tel;
}

// Mapeia status → classe da badge (mesma tabela do badgeHtml do legacy).
const BADGE_CLASS: Record<string, string> = {
  novo: "badge-novo",
  agendado: "badge-agendado",
  convertido: "badge-convertido",
  cancelado: "badge-cancelado",
  realizado: "badge-realizado",
  confirmado: "badge-confirmado",
  pendente: "badge-pendente",
};
export function statusBadgeClass(status?: string | null): string {
  return BADGE_CLASS[status ?? ""] || "badge-novo";
}
