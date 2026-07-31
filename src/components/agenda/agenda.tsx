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
import { TimeGrid } from "@/components/agenda/time-grid";
import { AgendaLista } from "@/components/agenda/agenda-lista";
import { MiniCalendario } from "@/components/agenda/mini-calendario";
import { MonthGrid } from "@/components/agenda/month-grid";
import { NewAgendModal } from "@/components/agenda/new-agend-modal";
import { EditAgendModal } from "@/components/agenda/edit-agend-modal";
import { DateFilter } from "@/components/date-filter";
import type { AgendamentoComLead } from "@/types/db";

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

  function quickAgendamento(dateStr: string, hour: number) {
    setPrefill({ data: dateStr, hora: String(hour).padStart(2, "0") + ":00" });
    setNewOpen(true);
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
