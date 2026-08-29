"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { rotuloIntervalo } from "@/lib/date";
import {
  DIAS_CURTOS,
  MESES,
  addMes,
  anosDisponiveis,
  gradeDoMes,
  lerPeriodoCustom,
  periodoCustom,
  posicaoNoRange,
} from "@/lib/periodo";

// Seletor de período com DUAS partes: atalhos à esquerda, calendário à direita.
//
// O que existia era só a lista de atalhos. Dava para pedir "últimos 30 dias",
// não dava para pedir "3 a 17 de julho" — e um painel de negócio vive de
// recortar um pedaço específico do passado.
//
// Três decisões de desenho que valem explicar:
//
// 1. CÉLULA QUADRADA (radius 4px), não redonda. Não é gosto: com célula
//    quadrada o preenchimento do intervalo encosta de borda a borda e vira uma
//    FAIXA contínua. Redonda — o padrão da maioria dos kits — vira uma fileira
//    de bolinhas soltas, que lê como seleção múltipla e não como intervalo.
//
// 2. O MIOLO DO INTERVALO É NEUTRO. Quase todo kit preenche o range inteiro
//    com um tom do accent. Num intervalo de 8 dias isso vira um borrão
//    colorido. Aqui só as duas PONTAS levam a cor da marca; o meio é
//    --mk-superficie-2. A cor passa a dizer "começa aqui, termina aqui".
//
// 3. MÊS E ANO SÃO <select>. Sem eles, chegar em março de 2024 custa vinte
//    cliques na setinha. Com eles, dois.

const ATALHOS: ReadonlyArray<readonly [string, string]> = [
  ["hoje", "Hoje"],
  ["ontem", "Ontem"],
  ["7d", "Últimos 7 dias"],
  ["15d", "Últimos 15 dias"],
  ["30d", "Últimos 30 dias"],
  ["mes", "Este mês"],
  ["90d", "Últimos 3 meses"],
  ["1a", "Último ano"],
  ["tudo", "Tudo"],
];

export function DateRangePicker({
  value,
  onChange,
  atalhos = ATALHOS,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Os atalhos da coluna da esquerda. A lista padrão olha para TRÁS; o
   *  Kanban passa uma que olha para frente, porque fila de trabalho é sobre o
   *  que ainda vem. O calendário e o intervalo à mão não mudam. */
  atalhos?: ReadonlyArray<readonly [string, string]>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Só no cliente: o rótulo do gatilho depende de HOJE, e o servidor está em
  // UTC — renderizar lá daria um dia diferente e quebraria a hidratação.
  const [rotulo, setRotulo] = useState<string | null>(null);
  useEffect(() => setRotulo(rotuloIntervalo(value)), [value]);

  // Seleção em curso. `de` sem `ate` = primeiro clique dado, esperando o
  // segundo. Só vira `onChange` quando o par fecha.
  const [de, setDe] = useState<Date | null>(null);
  const [ate, setAte] = useState<Date | null>(null);

  const hoje = useMemo(() => new Date(), []);
  const [vis, setVis] = useState(() => ({
    ano: hoje.getFullYear(),
    mes: hoje.getMonth(),
  }));

  // Ao abrir: mostra o mês do intervalo em vigor (não o mês corrente) e
  // recarrega a seleção, para que reabrir não pareça "perdi o que escolhi".
  useEffect(() => {
    if (!open) return;
    const atual = lerPeriodoCustom(value);
    if (atual) {
      setDe(atual.de);
      setAte(atual.ate);
      setVis({ ano: atual.de.getFullYear(), mes: atual.de.getMonth() });
    } else {
      setDe(null);
      setAte(null);
      const agora = new Date();
      setVis({ ano: agora.getFullYear(), mes: agora.getMonth() });
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const segundo = addMes(vis.ano, vis.mes, 1);
  const anos = anosDisponiveis(hoje.getFullYear(), vis.ano);

  function clicarDia(d: Date) {
    // Sem início, ou com o par já fechado: começa de novo.
    if (!de || ate) {
      setDe(d);
      setAte(null);
      return;
    }
    // Fecha o par e aplica. `periodoCustom` ordena as pontas, então clicar de
    // trás para frente funciona.
    setAte(d);
    onChange(periodoCustom(de, d));
    setOpen(false);
  }

  function renderMes(ano: number, mes: number) {
    return (
      <div className="drp-mes" key={`${ano}-${mes}`}>
        <div className="drp-mes-nome">
          {MESES[mes]} {ano}
        </div>
        <div className="drp-semana">
          {DIAS_CURTOS.map((d) => (
            <span key={d} className="drp-wd">
              {d}
            </span>
          ))}
        </div>
        <div className="drp-grade">
          {gradeDoMes(ano, mes).map((c) => {
            const pos = posicaoNoRange(c.data, de, ate);
            const ehHoje = c.chave === chaveHoje(hoje);
            return (
              <button
                key={c.chave}
                type="button"
                onClick={() => clicarDia(c.data)}
                className={[
                  "drp-dia",
                  pos === "extremidade" ? "ponta" : "",
                  pos === "dentro" ? "dentro" : "",
                  c.foraDoMes ? "fora" : "",
                  ehHoje ? "hoje" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={pos !== "fora"}
              >
                {c.data.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="date-filter drp" ref={ref}>
      <button
        type="button"
        className={`date-filter-trigger${open ? " open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays size={14} strokeWidth={1.6} />
        {/* Espaço reservado até o relógio do cliente responder: sem isso o
            cabeçalho reflui quando o rótulo chega. */}
        {rotulo ?? " "}
        <ChevronDown size={14} strokeWidth={1.5} className="chev" />
      </button>

      {open && (
        <div className="drp-pop" role="dialog" aria-label="Escolher período">
          <div className="drp-rail">
            <div className="drp-rail-titulo">Selecione</div>
            {atalhos.map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={`drp-atalho${v === value ? " ativo" : ""}`}
                onClick={() => {
                  onChange(v);
                  setOpen(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="drp-cal">
            <div className="drp-cab">
              <button
                type="button"
                className="drp-nav"
                aria-label="Mês anterior"
                onClick={() => setVis(addMes(vis.ano, vis.mes, -1))}
              >
                <ChevronLeft size={15} strokeWidth={2} />
              </button>
              <select
                className="drp-select"
                value={vis.mes}
                aria-label="Mês"
                onChange={(e) => setVis({ ...vis, mes: Number(e.target.value) })}
              >
                {MESES.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                className="drp-select"
                value={vis.ano}
                aria-label="Ano"
                onChange={(e) => setVis({ ...vis, ano: Number(e.target.value) })}
              >
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="drp-nav"
                aria-label="Próximo mês"
                onClick={() => setVis(addMes(vis.ano, vis.mes, 1))}
              >
                <ChevronRight size={15} strokeWidth={2} />
              </button>
            </div>

            <div className="drp-meses">
              {renderMes(vis.ano, vis.mes)}
              {renderMes(segundo.ano, segundo.mes)}
            </div>

            <div className="drp-rodape">
              {de && !ate
                ? "Escolha o dia final"
                : "Clique no primeiro e no último dia"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** `YYYY-MM-DD` de hoje, em horário local. */
function chaveHoje(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}
