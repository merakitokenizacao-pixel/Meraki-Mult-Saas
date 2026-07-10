"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAgendamentosComLead, useLeads } from "@/lib/hooks";
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
  const leadsQuery = useLeads();
  const agendamentos = agendQuery.data ?? [];
  const leads = leadsQuery.data ?? [];
  const loading = agendQuery.isPending;

  const [view, setView] = useState("semana");
  const [refDate, setRefDate] = useState<Date>(() => new Date());
  const [newOpen, setNewOpen] = useState(false);
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
            onCellClick={quickAgendamento}
            onEventClick={setEditAgend}
          />
        )}
      </div>

      <NewAgendModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        leads={leads}
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
