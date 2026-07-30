"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { getMonthMatrix, monthYearLabel, sameDay } from "@/lib/agenda";
import type { AgendamentoComLead } from "@/types/db";

const DIAS_MINI = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES_CURTO = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** Chave local do dia — não usa toISOString(), que converte para UTC. */
function chave(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Mini calendário para pular direto a uma data.
 *
 * Mora no cabeçalho da Agenda (e não dentro da lista) de propósito: ele move a
 * grade E a lista juntas. Um seletor de data só na lista criaria dois estados
 * de data disputando — a grade numa semana, a lista em outra.
 *
 * Os dias com atendimento ganham um ponto. É o que responde "quando é o próximo
 * movimento?" sem precisar navegar semana a semana às cegas.
 */
export function MiniCalendario({
  valor,
  onChange,
  agendamentos,
}: {
  valor: Date;
  onChange: (d: Date) => void;
  agendamentos: AgendamentoComLead[];
}) {
  const [aberto, setAberto] = useState(false);
  const [mesRef, setMesRef] = useState<Date>(valor);
  const ref = useRef<HTMLDivElement>(null);

  // Ao abrir, começa no mês da data selecionada.
  useEffect(() => {
    if (aberto) setMesRef(valor);
  }, [aberto, valor]);

  useEffect(() => {
    if (!aberto) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [aberto]);

  // Dias que têm ao menos um atendimento (cancelado não conta — não é movimento).
  const comAtendimento = useMemo(() => {
    const s = new Set<string>();
    for (const a of agendamentos) {
      if (!a.data_agendamento || a.status === "cancelado") continue;
      s.add(chave(new Date(a.data_agendamento)));
    }
    return s;
  }, [agendamentos]);

  const dias = useMemo(() => getMonthMatrix(mesRef), [mesRef]);
  const hoje = new Date();

  function irMes(dir: number) {
    setMesRef((p) => {
      const d = new Date(p);
      d.setDate(1);
      d.setMonth(d.getMonth() + dir);
      return d;
    });
  }

  const rotulo = `${valor.getDate()} ${MESES_CURTO[valor.getMonth()]}`;

  return (
    <div className="mini-cal" ref={ref}>
      <button
        type="button"
        className={`mini-cal-trigger${aberto ? " aberto" : ""}`}
        onClick={() => setAberto((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        title="Ir para uma data"
      >
        <CalendarDays size={14} strokeWidth={1.6} />
        {rotulo}
      </button>

      {aberto && (
        <div className="mini-cal-pop" role="dialog" aria-label="Escolher data">
          <div className="mini-cal-cab">
            <button
              type="button"
              onClick={() => irMes(-1)}
              aria-label="Mês anterior"
            >
              <ChevronLeft size={15} strokeWidth={1.8} />
            </button>
            <span className="mini-cal-mes">{monthYearLabel(mesRef)}</span>
            <button
              type="button"
              onClick={() => irMes(1)}
              aria-label="Próximo mês"
            >
              <ChevronRight size={15} strokeWidth={1.8} />
            </button>
          </div>

          <div className="mini-cal-grade">
            {DIAS_MINI.map((d, i) => (
              <span key={i} className="mini-cal-dow">
                {d}
              </span>
            ))}
            {dias.map((d) => {
              const foraDoMes = d.getMonth() !== mesRef.getMonth();
              const eHoje = sameDay(d, hoje);
              const selecionado = sameDay(d, valor);
              const tem = comAtendimento.has(chave(d));
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  className={`mini-cal-dia${foraDoMes ? " fora" : ""}${
                    eHoje ? " hoje" : ""
                  }${selecionado ? " sel" : ""}`}
                  onClick={() => {
                    onChange(d);
                    setAberto(false);
                  }}
                >
                  {d.getDate()}
                  {tem && <span className="mini-cal-ponto" />}
                </button>
              );
            })}
          </div>

          <div className="mini-cal-rodape">
            <span className="mini-cal-legenda">
              <span className="mini-cal-ponto estatico" /> tem atendimento
            </span>
            <button
              type="button"
              className="mini-cal-hoje"
              onClick={() => {
                onChange(new Date());
                setAberto(false);
              }}
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
