"use client";

import { Fragment, useMemo } from "react";
import { limparServico } from "@/lib/format";
import { CELL_H, HOURS, HOUR_END, HOUR_START, WEEKDAYS, dateKey } from "@/lib/agenda";
import type { AgendamentoComLead } from "@/types/db";

type PositionedEvent = {
  agend: AgendamentoComLead;
  top: number;
  height: number;
  time: string;
  nome: string;
  servico: string;
};

// Grade de horários (hora × dias) que serve tanto para a visão de Semana
// (7 dias) quanto de Dia (1 dia). Recebe a lista de dias a exibir.
export function TimeGrid({
  days,
  agendamentos,
  onCellClick,
  onEventClick,
}: {
  days: Date[];
  agendamentos: AgendamentoComLead[];
  onCellClick: (dateStr: string, hour: number) => void;
  onEventClick: (agend: AgendamentoComLead) => void;
}) {
  const todayStr = new Date().toDateString();
  const single = days.length === 1;

  // Mapa "dateStr|hour" -> eventos posicionados.
  const eventsByCell = useMemo(() => {
    const map = new Map<string, PositionedEvent[]>();
    const startMs = days[0].getTime();
    const endMs = new Date(days[days.length - 1]).setHours(23, 59, 59, 999);

    for (const a of agendamentos) {
      if (!a.data_agendamento) continue;
      const t = new Date(a.data_agendamento).getTime();
      if (t < startMs || t > endMs) continue;

      const dt = new Date(a.data_agendamento);
      const dayIdx = Math.floor(
        (new Date(a.data_agendamento).setHours(0, 0, 0, 0) - startMs) / 86400000
      );
      if (dayIdx < 0 || dayIdx > days.length - 1) continue;

      const hour = dt.getHours();
      const minute = dt.getMinutes();
      if (hour < HOUR_START || hour > HOUR_END) continue;

      const key = dateKey(days[dayIdx]) + "|" + hour;
      const positioned: PositionedEvent = {
        agend: a,
        top: (minute / 60) * CELL_H,
        height: CELL_H - 4,
        time: dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        nome: a.leads?.nome || "Cliente",
        servico: limparServico(a.servico),
      };
      const arr = map.get(key);
      if (arr) arr.push(positioned);
      else map.set(key, [positioned]);
    }
    return map;
  }, [agendamentos, days]);

  // Linha do horário atual.
  const nowLine = useMemo(() => {
    const now = new Date();
    const idx = days.findIndex((d) => d.toDateString() === now.toDateString());
    if (idx < 0 || now.getHours() < HOUR_START || now.getHours() > HOUR_END)
      return null;
    return {
      key: dateKey(days[idx]) + "|" + now.getHours(),
      top: (now.getMinutes() / 60) * CELL_H,
    };
  }, [days]);

  return (
    <div className="agenda-grid-wrap">
      <div
        className="agenda-grid"
        style={{
          gridTemplateColumns: `60px repeat(${days.length}, minmax(${single ? "0" : "120px"}, 1fr))`,
          width: single ? "100%" : undefined,
          minWidth: single ? 0 : 900,
        }}
      >
        <div className="agenda-corner" />
        {days.map((d) => {
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
            {days.map((d) => {
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
