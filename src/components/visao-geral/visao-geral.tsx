"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { rotuloIntervalo, saudacaoDe } from "@/lib/date";
import { DateFilter } from "@/components/date-filter";
import { Negocios } from "@/components/negocios/negocios";
import { Dashboard } from "@/components/dashboard/dashboard";

// Início com abas, no espírito da referência: um só cabeçalho e um só filtro
// de período no topo; as abas trocam só o CORPO. Duplicar saudação e filtro
// por aba seria repetir o mesmo controle duas vezes e deixar os dois
// dessincronizados.
//
// O período é estado DAQUI justamente por isso: trocar de aba não perde o
// recorte que a pessoa escolheu.

const PERIODS: ReadonlyArray<[string, string]> = [
  ["hoje", "Hoje"],
  ["ontem", "Ontem"],
  ["7d", "Últimos 7 dias"],
  ["30d", "Últimos 30 dias"],
  ["mes", "Este mês"],
  ["tudo", "Tudo"],
];

const ABAS = [
  { id: "negocios", label: "Negócios" },
  { id: "multiatendimento", label: "Multiatendimento" },
] as const;

type Aba = (typeof ABAS)[number]["id"];

export function VisaoGeral() {
  const [aba, setAba] = useState<Aba>("negocios");
  const [period, setPeriod] = useState("7d");
  const [greeting, setGreeting] = useState<{
    prefix: string;
    word: string;
  } | null>(null);
  const [intervalo, setIntervalo] = useState<string | null>(null);

  // Só no cliente (o servidor está em UTC e a saudação é local). Reavalia a
  // cada minuto porque o painel fica aberto o dia todo.
  useEffect(() => {
    const aplicar = () => setGreeting(saudacaoDe());
    aplicar();
    const t = setInterval(aplicar, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setIntervalo(rotuloIntervalo(period));
  }, [period]);

  return (
    <div className="page-fade">
      <div className="vg-header">
        <div>
          {/* Reserva a altura mesmo antes de o relógio do cliente responder,
              senão o título salta quando a saudação aparece. */}
          <div className="vg-saudacao">
            {greeting ? `${greeting.prefix} ${greeting.word}` : "\u00A0"}
          </div>
          <h1 className="vg-titulo">Visão geral</h1>
          <p className="vg-sub">Seu desempenho e atividades</p>
        </div>

        <div className="vg-controles">
          <DateFilter
            value={period}
            options={PERIODS}
            onChange={setPeriod}
            icone={<CalendarDays size={14} strokeWidth={1.6} />}
            rotulo={intervalo ?? undefined}
          />
          <div className="vg-abas" role="tablist" aria-label="Seções do início">
            {ABAS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={aba === a.id}
                onClick={() => setAba(a.id)}
                className={`vg-aba${aba === a.id ? " ativa" : ""}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {aba === "negocios" ? (
        <Negocios period={period} />
      ) : (
        <Dashboard period={period} />
      )}
    </div>
  );
}
