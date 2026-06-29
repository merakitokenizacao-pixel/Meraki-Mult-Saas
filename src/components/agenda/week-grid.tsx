"use client";

import { Fragment, useMemo } from "react";
import { limparServico } from "@/lib/format";
import {
  CELL_H,
  HOURS,
  HOUR_END,
  HOUR_START,
  WEEKDAYS,
  dateKey,
  getWeekDays,
} from "@/lib/agenda";
import type { AgendamentoComLead } from "@/types/db";

type PositionedEvent = {
  agend: AgendamentoComLead;
  top: number;
  height: number;
  time: string;
  nome: string;
  servico: string;
};

// renderWeekAgenda + renderEventsOnGrid: monta a grade e posiciona os eventos.
export function WeekGrid({
  weekStart,
  agendamentos,
  onCellClick,
  onEventClick,
}: {
  weekStart: Date;
  agendamentos: AgendamentoComLead[];
  onCellClick: (dateStr: string, hour: number) => void;
  onEventClick: (agend: AgendamentoComLead) => void;
}) {
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const todayStr = new Date().toDateString();

  // Mapa "dateStr|hour" -> eventos posicionados.
  const eventsByCell = useMemo(() => {
    const map = new Map<string, PositionedEvent[]>();
    const weekStartMs = weekDays[0].getTime();
    const weekEndMs = new Date(weekDays[6]).setHours(23, 59, 59, 999);

    for (const a of agendamentos) {
      if (!a.data_agendamento) continue;
      const t = new Date(a.data_agendamento).getTime();
      if (t < weekStartMs || t > weekEndMs) continue;

      const dt = new Date(a.data_agendamento);
      const dayIdx = Math.floor(
        (new Date(a.data_agendamento).setHours(0, 0, 0, 0) - weekStartMs) /
          86400000
      );
      if (dayIdx < 0 || dayIdx > 6) continue;

      const hour = dt.getHours();
      const minute = dt.getMinutes();
      if (hour < HOUR_START || hour > HOUR_END) continue;

      const key = dateKey(weekDays[dayIdx]) + "|" + hour;
      const positioned: PositionedEvent = {
        agend: a,
        top: (minute / 60) * CELL_H,
        height: (60 / 60) * CELL_H - 4,
        time: dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        nome: a.leads?.nome || "Cliente",
        servico: limparServico(a.servico),
      };
      const arr = map.get(key);
      if (arr) arr.push(positioned);
      else map.set(key, [positioned]);
    }
    return map;
  }, [agendamentos, weekDays]);

  // Linha do horário atual.
  const nowLine = useMemo(() => {
    const now = new Date();
    const idx = weekDays.findIndex((d) => d.toDateString() === now.toDateString());
    if (idx < 0 || now.getHours() < HOUR_START || now.getHours() > HOUR_END)
      return null;
    return {
      key: dateKey(weekDays[idx]) + "|" + now.getHours(),
      top: (now.getMinutes() / 60) * CELL_H,
    };
  }, [weekDays]);

  return (
    <div className="agenda-grid-wrap">
      <div className="agenda-grid">
        <div className="agenda-corner" />
        {weekDays.map((d) => {
          const isToday = d.toDateString() === todayStr;
          return (
            <div
              className={`agenda-day-head${isToday ? " today" : ""}`}
              key={dateKey(d)}
            >
              <span className="agenda-weekday">{WEEKDAYS[d.getDay()]}</span>
              <span className="agenda-daynum">{d.getDate()}</span>
            </div>
          );
        })}

        {HOURS.map((h) => (
          <Fragment key={h}>
            <div className="agenda-hour">
              <span>{String(h).padStart(2, "0")}:00</span>
            </div>
            {weekDays.map((d) => {
              const isToday = d.toDateString() === todayStr;
              const ds = dateKey(d);
              const cellKey = ds + "|" + h;
              const events = eventsByCell.get(cellKey) || [];
              return (
                <div
                  className={`agenda-cell${isToday ? " today" : ""}`}
                  key={ds}
                  onClick={() => onCellClick(ds, h)}
                >
                  {events.map((ev) => (
                    <div
                      key={ev.agend.id}
                      className={`agenda-event ${ev.agend.status}`}
                      style={{ top: ev.top, height: ev.height }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev.agend);
                      }}
                    >
                      <div className="agenda-event-time">{ev.time}</div>
                      <div className="agenda-event-name">{ev.nome}</div>
                      <div className="agenda-event-service">{ev.servico}</div>
                    </div>
                  ))}
                  {nowLine?.key === cellKey && (
                    <div className="agenda-now-line" style={{ top: nowLine.top }} />
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
