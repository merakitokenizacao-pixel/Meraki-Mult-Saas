"use client";

import { useEffect, useMemo, useState } from "react";
import { getAgendamentosComLead, getLeads } from "@/lib/queries";
import { showToast } from "@/lib/toast";
import {
  dateKey,
  getStartOfWeek,
  getWeekDays,
  monthLabel,
} from "@/lib/agenda";
import { WeekGrid } from "@/components/agenda/week-grid";
import { NewAgendModal } from "@/components/agenda/new-agend-modal";
import { EditAgendModal } from "@/components/agenda/edit-agend-modal";
import type { AgendamentoComLead, Lead } from "@/types/db";

export function Agenda() {
  const [agendamentos, setAgendamentos] = useState<AgendamentoComLead[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date>(() =>
    getStartOfWeek(new Date())
  );
  const [newOpen, setNewOpen] = useState(false);
  const [prefill, setPrefill] = useState({ data: "", hora: "" });
  const [editAgend, setEditAgend] = useState<AgendamentoComLead | null>(null);

  async function load() {
    try {
      const [a, l] = await Promise.all([getAgendamentosComLead(), getLeads()]);
      setAgendamentos(a);
      setLeads(l);
    } catch {
      showToast("Erro ao carregar a agenda.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
        onCreated={load}
      />
      <EditAgendModal
        agend={editAgend}
        allAgendamentos={agendamentos}
        onClose={() => setEditAgend(null)}
        onChanged={load}
      />
    </div>
  );
}
