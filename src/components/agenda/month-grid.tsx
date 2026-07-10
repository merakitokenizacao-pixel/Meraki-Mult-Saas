"use client";

import { useMemo } from "react";
import { WEEKDAYS, dateKey, getMonthMatrix, sameDay } from "@/lib/agenda";
import type { AgendamentoComLead } from "@/types/db";

// Visão de Mês: grade 7×6 (dias × semanas). Cada célula mostra o dia e até 3
// chips de agendamento (hora + cliente), coloridos por status.
export function MonthGrid({
  refDate,
  agendamentos,
  onDayClick,
  onEventClick,
}: {
  refDate: Date;
  agendamentos: AgendamentoComLead[];
  onDayClick: (dateStr: string) => void;
  onEventClick: (agend: AgendamentoComLead) => void;
}) {
  const matrix = useMemo(() => getMonthMatrix(refDate), [refDate]);
  const month = refDate.getMonth();
  const now = new Date();

  function eventsOf(day: Date): AgendamentoComLead[] {
    return agendamentos
      .filter(
        (a) => a.data_agendamento && sameDay(new Date(a.data_agendamento), day)
      )
      .sort(
        (a, b) =>
          new Date(a.data_agendamento).getTime() -
          new Date(b.data_agendamento).getTime()
      );
  }

  return (
    <div className="agenda-month-grid">
      {WEEKDAYS.map((w) => (
        <div className="agenda-mday-head" key={w}>
          {w}
        </div>
      ))}
      {matrix.map((day) => {
        const evs = eventsOf(day);
        const out = day.getMonth() !== month;
        const isToday = sameDay(day, now);
        return (
          <div
            key={dateKey(day)}
            className={`agenda-mcell${out ? " out" : ""}${isToday ? " today" : ""}`}
            onClick={() => onDayClick(dateKey(day))}
          >
            <div className="agenda-mday-num">{day.getDate()}</div>
            <div className="agenda-mevents">
              {evs.slice(0, 3).map((a) => {
                const time = new Date(a.data_agendamento).toLocaleTimeString(
                  "pt-BR",
                  { hour: "2-digit", minute: "2-digit" }
                );
                const nome = a.leads?.nome || "Cliente";
                return (
                  <div
                    key={a.id}
                    className={`agenda-mevent ${a.status}`}
                    title={`${time} · ${nome}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(a);
                    }}
                  >
                    {time} {nome}
                  </div>
                );
              })}
              {evs.length > 3 && (
                <div className="agenda-mmore">+{evs.length - 3}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
