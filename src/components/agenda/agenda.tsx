"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAgendamentosComLead, useLeads } from "@/lib/hooks";
import {
  dateKey,
  getStartOfWeek,
  getWeekDays,
  monthLabel,
} from "@/lib/agenda";
import { WeekGrid } from "@/components/agenda/week-grid";
import { NewAgendModal } from "@/components/agenda/new-agend-modal";
import { EditAgendModal } from "@/components/agenda/edit-agend-modal";
import type { AgendamentoComLead } from "@/types/db";

export function Agenda() {
  const qc = useQueryClient();
  const agendQuery = useAgendamentosComLead();
  const leadsQuery = useLeads();
  const agendamentos = agendQuery.data ?? [];
  const leads = leadsQuery.data ?? [];
  const loading = agendQuery.isPending;

  const [weekStart, setWeekStart] = useState<Date>(() =>
    getStartOfWeek(new Date())
  );
  const [newOpen, setNewOpen] = useState(false);
  const [prefill, setPrefill] = useState({ data: "", hora: "" });
  const [editAgend, setEditAgend] = useState<AgendamentoComLead | null>(null);

  // Recarrega após criar/editar/excluir: invalida os agendamentos (prefixo,
  // pega a lista com e sem join) e os leads (o novo agendamento marca o lead
  // como "agendado").
  function refresh() {
    qc.invalidateQueries({ queryKey: ["agendamentos"] });
    qc.invalidateQueries({ queryKey: ["leads"] });
  }

  const label = useMemo(() => monthLabel(getWeekDays(weekStart)), [weekStart]);

  function gotoToday() {
    setWeekStart(getStartOfWeek(new Date()));
  }
  function prevWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }
  function nextWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }

  function quickAgendamento(dateStr: string, hour: number) {
    setPrefill({ data: dateStr, hora: String(hour).padStart(2, "0") + ":00" });
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
          <button className="agenda-arrow" onClick={prevWeek}>
            ‹
          </button>
          <button className="agenda-arrow" onClick={nextWeek}>
            ›
          </button>
          <div className="agenda-month">{label}</div>
        </div>
        <button className="btn-primary" onClick={openNewAgendamento}>
          + Novo
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="loading">
            <div className="spinner" />
          </div>
        ) : (
          <WeekGrid
            weekStart={weekStart}
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
