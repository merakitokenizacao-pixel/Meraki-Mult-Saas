"use client";

import { Fragment, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  Bot,
  CalendarCheck,
  Hourglass,
  Inbox,
  Moon,
  RefreshCw,
  Search,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DateFilter } from "@/components/date-filter";
import { getRelativeTime } from "@/lib/format";
import { getLastMsgPreview, lastMsgInfo } from "@/lib/conversa";
import { InboxSkeleton } from "@/components/conversas/skeletons";
import type { EstadoConversa } from "@/lib/estado-conversa";
import type { Conversa, Lead } from "@/types/db";

export type FiltroConversa = "tudo" | EstadoConversa;

// A barra de estado. Sete estados foram desenhados; o banco sustenta cinco —
// `resolvido`, `erro` e `arquivado` não têm coluna que os produza, e o motivo
// de cada um está em `lib/estado-conversa.ts`. Chip que não pode contar nada
// seria decoração com cara de dado.
//
// Dois grupos, separados por um respiro maior:
//   FILA     o que está acontecendo agora — com contagem
//   DESTINO  onde a conversa foi parar — sem contagem, porque cresce para
//            sempre e o número não é acionável
const CHIPS: ReadonlyArray<{
  id: FiltroConversa;
  rotulo: string;
  icone: LucideIcon;
  grupo: "fila" | "destino";
  /** Título e frase do vazio: o que fazer, não só o que não tem. */
  vazio: [string, string];
}> = [
  {
    id: "tudo",
    rotulo: "Tudo",
    icone: Inbox,
    grupo: "fila",
    vazio: [
      "Sem conversas ainda",
      "Quando alguém escrever no WhatsApp da clínica, a conversa aparece aqui.",
    ],
  },
  {
    id: "aguardando",
    rotulo: "Aguardando",
    icone: Hourglass,
    grupo: "fila",
    vazio: [
      "Nada esperando resposta",
      "Uma conversa entra aqui quando a IA está pausada nela e o cliente escreve. É a fila do “precisa de mim agora”.",
    ],
  },
  {
    id: "atendendo",
    rotulo: "Atendendo",
    icone: UserRound,
    grupo: "fila",
    vazio: [
      "Ninguém em atendimento manual",
      "Abra uma conversa e pause a IA para assumir você mesma — ela aparece aqui enquanto estiver com você.",
    ],
  },
  {
    id: "ia",
    rotulo: "IA",
    icone: Bot,
    grupo: "fila",
    vazio: [
      "A IA não está conduzindo nenhuma conversa",
      "Retome a IA numa conversa pausada para ela voltar a atender sozinha.",
    ],
  },
  {
    id: "agendado",
    rotulo: "Agendado",
    icone: CalendarCheck,
    grupo: "fila",
    vazio: [
      "Nenhum horário marcado",
      "Entra aqui quem tem agendamento pendente ou confirmado ainda por acontecer.",
    ],
  },
  {
    id: "inativo",
    rotulo: "Inativo",
    icone: Moon,
    grupo: "destino",
    vazio: [
      "Ninguém parado há mais de 30 dias",
      "Toda conversa teve movimento no último mês.",
    ],
  },
];

// Filtro por última atividade da conversa (não por criação do lead).
const PERIODS: ReadonlyArray<[string, string]> = [
  ["tudo", "Tudo"],
  ["hoje", "Hoje"],
  ["ontem", "Ontem"],
  ["semana", "Semana"],
  ["mes", "Mês"],
];

export function InboxList({
  leads,
  conversas,
  filtro,
  counts,
  period,
  currentLeadId,
  loading,
  somLigado,
  onAlternarSom,
  onSelectFiltro,
  onSelectPeriod,
  onSelectLead,
  onRefresh,
}: {
  leads: Lead[];
  conversas: Conversa[];
  filtro: FiltroConversa;
  counts: Record<FiltroConversa, number>;
  period: string;
  currentLeadId: string | null;
  loading: boolean;
  somLigado: boolean;
  onAlternarSom: () => void;
  onSelectFiltro: (f: FiltroConversa) => void;
  onSelectPeriod: (p: string) => void;
  onSelectLead: (id: string) => void;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  // A busca nasce fechada: ela não é a ação principal de quem abre a tela.
  const [buscaAberta, setBuscaAberta] = useState(false);
  const barra = useRef<HTMLDivElement>(null);
  const chipAtual = CHIPS.find((c) => c.id === filtro) ?? CHIPS[0];

  const q = query.trim().toLowerCase();
  const filtered = q
    ? leads.filter(
        (l) =>
          (l.nome || "").toLowerCase().includes(q) ||
          (l.telefone || "").includes(query.trim())
      )
    : leads;

  // Seta anda entre os chips e já troca o filtro, como manda o padrão de
  // `tablist`. Foco roving: só o chip ativo é tabulável.
  function aoTeclarChip(e: React.KeyboardEvent, i: number) {
    const passo =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : e.key === "Home"
            ? -i
            : e.key === "End"
              ? CHIPS.length - 1 - i
              : 0;
    if (passo === 0) return;
    e.preventDefault();
    const destino = (i + passo + CHIPS.length) % CHIPS.length;
    onSelectFiltro(CHIPS[destino].id);
    barra.current
      ?.querySelectorAll<HTMLButtonElement>("[role=tab]")
      [destino]?.focus();
  }

  const [vazioTitulo, vazioTexto] = q
    ? ["Nada encontrado", "Tente o telefone, ou outro trecho do nome."]
    : chipAtual.vazio;

  return (
    <div className="conv-col">
      <div className="conv-topo">
        <div className="conv-topo-linha">
          {buscaAberta ? (
            <div className="conv-busca">
              <Search size={14} strokeWidth={1.5} className="conv-busca-icone" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setQuery("");
                    setBuscaAberta(false);
                  }
                }}
                placeholder="Nome ou telefone"
                aria-label="Buscar conversa"
                className="conv-busca-campo"
              />
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setBuscaAberta(false);
                }}
                aria-label="Fechar busca"
                className="conv-acao"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <>
              {/* O nome da fila e a contagem SÃO o título. */}
              <h2 className="conv-titulo">{chipAtual.rotulo}</h2>
              {chipAtual.grupo === "fila" && (
                <span className="conv-titulo-contagem">{counts[filtro]}</span>
              )}
              <div className="conv-topo-acoes">
                <button
                  type="button"
                  onClick={() => setBuscaAberta(true)}
                  title="Buscar"
                  aria-label="Buscar conversa"
                  className="conv-acao"
                >
                  <Search size={15} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={onAlternarSom}
                  title={
                    somLigado
                      ? "Aviso sonoro ligado — clique para silenciar"
                      : "Aviso sonoro desligado — clique para ligar"
                  }
                  aria-label="Aviso sonoro de mensagem nova"
                  aria-pressed={somLigado}
                  className={`conv-acao${somLigado ? " ligada" : ""}`}
                >
                  {somLigado ? (
                    <Bell size={15} strokeWidth={1.5} />
                  ) : (
                    <BellOff size={15} strokeWidth={1.5} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={onRefresh}
                  title="Atualizar"
                  aria-label="Atualizar"
                  className="conv-acao"
                >
                  <RefreshCw size={15} strokeWidth={1.5} />
                </button>
                <DateFilter
                  value={period}
                  options={PERIODS}
                  onChange={onSelectPeriod}
                  compact
                />
              </div>
            </>
          )}
        </div>

        {/* `role="tablist"` e não um grupo de toggles: os filtros são
            mutuamente exclusivos e trocam o conteúdo da MESMA região, que é
            exatamente o que uma aba faz. Por isso o estado vai em
            `aria-selected` — `role="tab"` não aceita `aria-pressed`, e os dois
            juntos fazem o leitor de tela anunciar coisa nenhuma. O `aria-label`
            leva o nome do estado e a contagem: ícone colorido sozinho não
            comunica para quem não distingue cor. */}
        <div
          className="conv-chips"
          role="tablist"
          aria-label="Estado das conversas"
          ref={barra}
        >
          {CHIPS.map((c, i) => {
            const ativo = filtro === c.id;
            const temContagem = c.grupo === "fila";
            const n = counts[c.id] ?? 0;
            const anterior = CHIPS[i - 1];
            return (
              // Fragment, e não um <div> com `display: contents`: o
              // separador e o chip precisam ser IRMÃOS dentro do `tablist`,
              // senão a relação entre a lista e as abas se perde.
              <Fragment key={c.id}>
                {anterior && anterior.grupo !== c.grupo && (
                  <span className="conv-chips-sep" aria-hidden="true" />
                )}
                <button
                  type="button"
                  id={`conv-chip-${c.id}`}
                  role="tab"
                  aria-selected={ativo}
                  aria-controls="conv-lista"
                  tabIndex={ativo ? 0 : -1}
                  data-estado={c.id === "tudo" ? undefined : c.id}
                  onClick={() => onSelectFiltro(c.id)}
                  onKeyDown={(e) => aoTeclarChip(e, i)}
                  title={c.rotulo}
                  aria-label={
                    temContagem
                      ? `${c.rotulo}, ${n} conversa${n === 1 ? "" : "s"}`
                      : c.rotulo
                  }
                  className={`conv-chip${ativo ? " ativo" : ""}${
                    temContagem && n === 0 ? " vazio" : ""
                  }`}
                >
                  <span className="conv-chip-icone" aria-hidden="true">
                    <c.icone size={14} strokeWidth={1.7} />
                  </span>
                  {temContagem && (
                    <span className="conv-chip-contagem">{n}</span>
                  )}
                </button>
              </Fragment>
            );
          })}
        </div>
      </div>

      <div
        className="conv-lista"
        id="conv-lista"
        role="tabpanel"
        aria-labelledby={`conv-chip-${filtro}`}
      >
        {loading ? (
          <InboxSkeleton />
        ) : filtered.length === 0 ? (
          <div className="conv-vazio">
            <p className="conv-vazio-titulo">{vazioTitulo}</p>
            <p className="conv-vazio-texto">{vazioTexto}</p>
          </div>
        ) : (
          filtered.map((l) => {
            const preview = getLastMsgPreview(l, conversas);
            const { raw } = lastMsgInfo(l, conversas);
            const unread = Number(l.nao_lidas) || 0;
            const showUnread = unread > 0 && currentLeadId !== l.id;
            const active = currentLeadId === l.id;
            return (
              <button
                key={l.id}
                onClick={() => onSelectLead(l.id)}
                // A barra lateral do selecionado saiu: era a única
                // `box-shadow` do painel fora da que tapa o autofill, e o
                // sistema separa por borda. O fundo no acento a 12% já diz
                // qual conversa está aberta.
                className={`flex w-full items-center gap-3 border-b border-mk-linha/50 px-6 py-3 text-left transition-colors ${
                  active ? "bg-mk-acento-fraco" : "hover:bg-mk-superficie-2/60"
                }`}
              >
                <Avatar nome={l.nome} fotoUrl={l.foto_url} size={44} fontSize={12} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-mk-tinta">
                      {l.nome || l.telefone || "—"}
                    </span>
                    {/* "há 5 min" é FRASE, não dado tabular: saiu da mono. */}
                    <span className="shrink-0 text-[10px] text-mk-tinta-fraca">
                      {getRelativeTime(raw)}
                    </span>
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-2">
                    <span className="truncate text-[12px] text-mk-tinta-fraca">
                      {preview.text}
                    </span>
                  </div>
                </div>
                {showUnread && (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-mk-acento px-1.5 text-[10px] font-bold tabular-nums text-mk-sobre-acento">
                    {unread}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
