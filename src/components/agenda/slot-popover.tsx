"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarOff, CalendarPlus, X } from "lucide-react";
import {
  estadoDoSlot,
  getSituacaoSlot,
  linhasDoSlot,
  marcadasNoSlot,
  marcadasSemDono,
  resumoSlot,
} from "@/lib/slot-agenda";
import type { AgendamentoComLead } from "@/types/db";

// O que fazer com um horário — e o que ele JÁ É.
//
// Antes isto era um card centralizado na tela com dois textos soltos, que não
// dizia nada sobre o horário clicado. O banco sabe a lotação; o popover passou
// a perguntar.

const LARGURA = 280;
const MARGEM = 8;

const DIAS = [
  "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado",
];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function tituloDoSlot(dataStr: string, hora: number): string {
  const [a, m, d] = dataStr.split("-").map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DIAS[dt.getDay()]}, ${d} de ${MESES[m - 1]} · ${String(hora).padStart(2, "0")}:00`;
}

export interface AlvoSlot {
  data: string;
  hora: number;
  /** Retângulo da célula clicada: o popover sai DELA, não do meio da tela. */
  rect: { top: number; left: number; width: number; height: number };
}

export function SlotPopover({
  alvo,
  agendamentos,
  onFechar,
  onAgendar,
  onBloquear,
}: {
  alvo: AlvoSlot;
  agendamentos: AgendamentoComLead[];
  onFechar: () => void;
  onAgendar: () => void;
  onBloquear: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const { data } = useQuery({
    queryKey: ["slot-situacao", alvo.data, alvo.hora],
    queryFn: () => getSituacaoSlot(alvo.data, alvo.hora),
    // A situação muda com bloqueio e com agendamento novo; 30s é curto o
    // bastante para não mostrar vaga que já foi tomada.
    staleTime: 30_000,
  });

  const checagem = data?.checagem ?? null;
  const escala = data?.escala ?? [];
  const estado = estadoDoSlot(checagem);
  const marcadas = marcadasNoSlot(agendamentos, alvo.data, alvo.hora);
  const linhas = linhasDoSlot(escala, marcadas);
  const semDono = marcadasSemDono(escala, marcadas);

  // Posiciona depois de medir a altura real: com altura fixa chutada, o
  // popover de 3 profissionais e o de 1 abririam em lugares diferentes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const alt = el.offsetHeight;
    const r = alvo.rect;
    const abaixo = r.top + r.height + MARGEM;
    // Não coube para baixo: abre para cima, a partir do topo da célula.
    const top =
      abaixo + alt <= window.innerHeight - MARGEM
        ? abaixo
        : Math.max(MARGEM, r.top - alt - MARGEM);
    const left = Math.min(
      Math.max(MARGEM, r.left),
      window.innerWidth - LARGURA - MARGEM
    );
    setPos({ top, left });
  }, [alvo, linhas.length, semDono.length, estado]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onFechar]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="slotp-fora" onClick={onFechar} />
      <div
        ref={ref}
        className="slotp"
        role="dialog"
        aria-label="Ações do horário"
        style={{
          top: pos?.top ?? alvo.rect.top,
          left: pos?.left ?? alvo.rect.left,
          // Só aparece depois de medido: sem isto ele pisca no canto antes de
          // achar o lugar.
          visibility: pos ? "visible" : "hidden",
        }}
      >
        <div className="slotp-topo">
          <div className="slotp-quando">{tituloDoSlot(alvo.data, alvo.hora)}</div>
          <button
            type="button"
            className="slotp-fechar"
            aria-label="Fechar"
            onClick={onFechar}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        {/* Esqueleto no lugar do resumo enquanto as RPCs não voltam — as ações
            abaixo já ficam clicáveis, o menu não trava esperando dado. */}
        <div className="slotp-resumo">
          {checagem ? (
            resumoSlot(checagem, escala.length)
          ) : (
            <span className="slotp-esqueleto" />
          )}
        </div>

        {linhas.length > 0 && (
          <ul className="slotp-profs">
            {linhas.map((l) => (
              <li key={l.nome}>
                <span className="slotp-prof-nome">{l.nome}</span>
                {l.livre && <span className="slotp-livre">livre</span>}
                {l.com && <span className="slotp-com">{l.com}</span>}
                {l.indefinido && <span className="slotp-com">—</span>}
              </li>
            ))}
          </ul>
        )}

        {/* Clientes que o banco não permite atribuir a ninguém: elas aparecem,
            mas sem dono inventado. */}
        {semDono.length > 0 && (
          <div className="slotp-marcadas">
            <span className="slotp-marcadas-rot">Marcadas neste horário</span>
            {semDono.join(", ")}
          </div>
        )}

        <div className="slotp-acoes">
          {estado !== "fechado" && (
            <button type="button" className="slotp-acao" onClick={onAgendar}>
              <CalendarPlus
                size={15}
                strokeWidth={1.8}
                className={estado === "sem-vaga" ? "slotp-ic-alerta" : "slotp-ic-primaria"}
              />
              <span className="slotp-acao-txt">
                <span className="slotp-acao-rot">
                  {estado === "sem-vaga" ? "Encaixar mesmo assim" : "Marcar cliente"}
                </span>
                <span className="slotp-acao-sub">
                  {estado === "sem-vaga"
                    ? "Todas ocupadas — vai ficar acima da capacidade"
                    : `Ocupa a vaga livre das ${String(alvo.hora).padStart(2, "0")}:00`}
                </span>
              </span>
            </button>
          )}
          {/* Bloquear continua mesmo com o dia fechado: bloquear o que já está
              fechado é inofensivo, e é o caminho para marcar férias num
              domingo. */}
          <button type="button" className="slotp-acao" onClick={onBloquear}>
            <CalendarOff size={15} strokeWidth={1.8} />
            <span className="slotp-acao-txt">
              <span className="slotp-acao-rot">Bloquear horário</span>
              <span className="slotp-acao-sub">Tira da agenda sem marcar ninguém</span>
            </span>
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
