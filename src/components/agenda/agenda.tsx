"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAgendaSlots, useAgendamentosComLead, useLeads } from "@/lib/hooks";
import type { SlotAgenda } from "@/lib/queries";
import {
  dateKey,
  dayLabel,
  getStartOfWeek,
  getWeekDays,
  monthLabel,
  monthYearLabel,
  startOfDay,
} from "@/lib/agenda";
import { CalendarOff, CalendarPlus } from "lucide-react";
import { Modal } from "@/components/modal";
import { TimeGrid } from "@/components/agenda/time-grid";
import { AgendaLista } from "@/components/agenda/agenda-lista";
import { MiniCalendario } from "@/components/agenda/mini-calendario";
import { MonthGrid } from "@/components/agenda/month-grid";
import { NewAgendModal } from "@/components/agenda/new-agend-modal";
import { EditAgendModal } from "@/components/agenda/edit-agend-modal";
import { DateFilter } from "@/components/date-filter";
import { BloquearModal } from "@/components/agenda/bloquear-modal";
import { BloqueioPopover } from "@/components/agenda/bloqueio-popover";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getBloqueiosNoPeriodo, type Bloqueio } from "@/lib/bloqueios";
import type { AgendamentoComLead } from "@/types/db";

// As profissionais servem ao seletor "Quem" do bloqueio. Lista curta (4) e
// carregada só quando o modal abre.
async function getProfissionaisAtivas() {
  const { data, error } = await supabase
    .from("profissionais")
    .select("id,nome,ativo")
    .order("nome")
    .limit(200);
  if (error) throw error;
  return (data ?? []) as { id: string; nome: string; ativo: boolean }[];
}

// Seletor de visão do calendário (Dia / Semana / Mês).
const VIEWS: ReadonlyArray<[string, string]> = [
  ["dia", "Dia"],
  ["semana", "Semana"],
  ["mes", "Mês"],
];

export function Agenda() {
  const qc = useQueryClient();
  const agendQuery = useAgendamentosComLead();
  const [view, setView] = useState("semana");
  const [refDate, setRefDate] = useState<Date>(() => new Date());
  const [newOpen, setNewOpen] = useState(false);
  // Escolha entre agendar e bloquear: guarda o slot clicado até a pessoa
  // decidir. Antes o clique ia direto para "Novo agendamento", e era por isso
  // que bloquear virava agendamento falso.
  const [escolha, setEscolha] = useState<{ data: string; hora: string } | null>(
    null
  );
  const [blqOpen, setBlqOpen] = useState(false);
  const [blqPre, setBlqPre] = useState({ data: "", hora: "" });
  const [blqAberto, setBlqAberto] = useState<Bloqueio | null>(null);

  // A lista de leads serve só ao combobox do modal de novo agendamento. Baixar
  // os ~375 leads inteiros na abertura da Agenda, para um modal que pode nem
  // ser aberto, era o maior desperdício da tela.
  const leadsQuery = useLeads({ enabled: newOpen });
  const agendamentos = agendQuery.data ?? [];
  const leads = leadsQuery.data ?? [];
  const loading = agendQuery.isPending;

  const [prefill, setPrefill] = useState({ data: "", hora: "" });
  const [editAgend, setEditAgend] = useState<AgendamentoComLead | null>(null);

  // Recarrega após criar/editar/excluir: invalida agendamentos + leads.
  function refresh() {
    qc.invalidateQueries({ queryKey: ["agendamentos"] });
    qc.invalidateQueries({ queryKey: ["leads"] });
    // O bloqueio derruba a CAPACIDADE do horário, então os slots precisam ser
    // relidos junto — senão a célula continua oferecendo vaga que não existe
    // mais até o próximo refresh.
    // Os slots vêm junto: a chave deles é ["agendamentos","slots",…] e o
    // prefixo já foi invalidado acima.
    qc.invalidateQueries({ queryKey: ["profissional-bloqueios"] });
  }

  // Dias exibidos na grade de horários (Dia = 1, Semana = 7).
  const days = useMemo(
    () =>
      view === "dia" ? [startOfDay(refDate)] : getWeekDays(getStartOfWeek(refDate)),
    [view, refDate]
  );

  // Disponibilidade do período visível, DERIVADA DA ESCALA das profissionais
  // (função `agenda_slots` no banco). Antes isso era calculado no cliente por
  // uma grade hardcoded em TypeScript — que divergia do que a Laura usava.
  const de = dateKey(days[0]);
  const ate = dateKey(days[days.length - 1]);
  const slotsQuery = useAgendaSlots(de, ate);

  // Bloqueios do intervalo visível. Chave com as pontas: navegar de semana
  // busca a nova janela em vez de reusar a anterior.
  const bloqueiosQuery = useQuery({
    queryKey: ["profissional-bloqueios", de, ate],
    queryFn: () => getBloqueiosNoPeriodo(de, ate),
  });
  const bloqueios = bloqueiosQuery.data ?? [];

  // Só quando um dos dois modais precisa dos nomes.
  const profissionaisQuery = useQuery({
    queryKey: ["profissionais-ativas"],
    queryFn: getProfissionaisAtivas,
    enabled: blqOpen || blqAberto !== null,
  });
  const slots = useMemo(() => {
    const m = new Map<string, SlotAgenda>();
    for (const s of slotsQuery.data ?? []) m.set(`${s.data}|${s.hora}`, s);
    return m;
  }, [slotsQuery.data]);

  // Agendamentos da janela que está na tela — a lista abaixo da grade mostra
  // exatamente o mesmo recorte que a grade desenha, incluindo a visão de Mês
  // (onde `days` não se aplica).
  const doPeriodoVisivel = useMemo(() => {
    let ini: Date, fim: Date;
    if (view === "mes") {
      ini = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
      fim = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);
    } else {
      ini = new Date(days[0]);
      ini.setHours(0, 0, 0, 0);
      fim = new Date(days[days.length - 1]);
      fim.setHours(24, 0, 0, 0);
    }
    return agendamentos.filter((a) => {
      if (!a.data_agendamento) return false;
      const t = new Date(a.data_agendamento).getTime();
      return t >= ini.getTime() && t < fim.getTime();
    });
  }, [agendamentos, view, refDate, days]);

  const label = useMemo(() => {
    if (view === "dia") return dayLabel(refDate);
    if (view === "mes") return monthYearLabel(refDate);
    return monthLabel(getWeekDays(getStartOfWeek(refDate)));
  }, [view, refDate]);

  function gotoToday() {
    setRefDate(new Date());
  }
  // Navega conforme a visão: ±1 dia, ±1 semana ou ±1 mês.
  function step(dir: number) {
    setRefDate((prev) => {
      const d = new Date(prev);
      if (view === "dia") d.setDate(d.getDate() + dir);
      else if (view === "mes") d.setMonth(d.getMonth() + dir);
      else d.setDate(d.getDate() + dir * 7);
      return d;
    });
  }

  // O clique na célula não decide mais sozinho: oferece os dois caminhos.
  function quickAgendamento(dateStr: string, hour: number) {
    setEscolha({ data: dateStr, hora: String(hour).padStart(2, "0") + ":00" });
  }
  function agendarDoSlot() {
    if (!escolha) return;
    setPrefill(escolha);
    setNewOpen(true);
    setEscolha(null);
  }
  function bloquearDoSlot() {
    if (!escolha) return;
    setBlqPre(escolha);
    setBlqOpen(true);
    setEscolha(null);
  }
  function quickDay(dateStr: string) {
    setPrefill({ data: dateStr, hora: "" });
    setNewOpen(true);
  }
  function openNewAgendamento() {
    setPrefill({ data: dateKey(new Date()), hora: "" });
    setNewOpen(true);
  }

  return (
    <div className="page-fade">
      <div className="agenda-header">
        <div className="agenda-nav">
          <button className="agenda-nav-btn" onClick={gotoToday}>
            Hoje
          </button>
          <button className="agenda-arrow" onClick={() => step(-1)}>
            ‹
          </button>
          <button className="agenda-arrow" onClick={() => step(1)}>
            ›
          </button>
          <div className="agenda-month">{label}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Pula direto para uma data, marcando os dias que têm atendimento —
              move a grade E a lista juntas. */}
          <MiniCalendario
            valor={refDate}
            onChange={setRefDate}
            agendamentos={agendamentos}
          />
          <DateFilter value={view} options={VIEWS} onChange={setView} />
          <button className="btn-primary" onClick={openNewAgendamento}>
            + Novo
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="loading">
            <div className="spinner" />
          </div>
        ) : view === "mes" ? (
          <MonthGrid
            refDate={refDate}
            agendamentos={agendamentos}
            onDayClick={quickDay}
            onEventClick={setEditAgend}
          />
        ) : (
          <TimeGrid
            days={days}
            agendamentos={agendamentos}
            slots={slots}
            onCellClick={quickAgendamento}
            onEventClick={setEditAgend}
            bloqueios={bloqueios}
            onBloqueioClick={setBlqAberto}
          />
        )}
      </div>

      {/* Lista do período visível — a leitura completa, sem o aperto da grade */}
      {!loading && (
        <AgendaLista
          agendamentos={doPeriodoVisivel}
          onEventClick={setEditAgend}
        />
      )}

      {/* Escolha do que fazer com o horário clicado. Dois caminhos, um clique
          cada — sem isso, bloquear continuaria virando agendamento falso. */}
      {escolha && (
        <Modal open onClose={() => setEscolha(null)} width={320}>
          <div className="blq-titulo">
            {escolha.hora} · {escolha.data.split("-").reverse().join("/")}
          </div>
          <div className="blq-escolha">
            <button type="button" className="blq-opcao" onClick={agendarDoSlot}>
              <CalendarPlus size={15} strokeWidth={1.8} />
              <span>
                <strong>Novo agendamento</strong>
                <em>Marcar uma cliente neste horário</em>
              </span>
            </button>
            <button type="button" className="blq-opcao" onClick={bloquearDoSlot}>
              <CalendarOff size={15} strokeWidth={1.8} />
              <span>
                <strong>Bloquear horário</strong>
                <em>Tirar da agenda sem marcar ninguém</em>
              </span>
            </button>
          </div>
        </Modal>
      )}

      <BloquearModal
        aberto={blqOpen}
        onClose={() => setBlqOpen(false)}
        onSalvo={refresh}
        profissionais={profissionaisQuery.data ?? []}
        agendamentos={agendamentos}
        dataInicial={blqPre.data}
        horaInicial={blqPre.hora}
      />
      {blqAberto && (
        <BloqueioPopover
          bloqueio={blqAberto}
          nomeProfissional={
            (profissionaisQuery.data ?? []).find(
              (p) => p.id === blqAberto.profissional_id
            )?.nome ?? "Profissional"
          }
          onClose={() => setBlqAberto(null)}
          onRemovido={refresh}
        />
      )}

      <NewAgendModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        leads={leads}
        leadsLoading={leadsQuery.isPending}
        prefill={prefill}
        onCreated={refresh}
      />
      <EditAgendModal
        agend={editAgend}
        allAgendamentos={agendamentos}
        onClose={() => setEditAgend(null)}
        onChanged={refresh}
      />
    </div>
  );
}
