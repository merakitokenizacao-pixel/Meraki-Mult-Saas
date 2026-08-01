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
  ["semana", "Semana"],
  ["mes", "Mês"],
  ["tudo", "Tudo"],
];

const ABAS = [
  { id: "negocios", label: "Negócios" },
  { id: "multiatendimento", label: "Multiatendimento" },
] as const;

type Aba = (typeof ABAS)[number]["id"];

export function VisaoGeral() {
  const [aba, setAba] = useState<Aba>("negocios");
  const [period, setPeriod] = useState("hoje");
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
          <div className="dash-greeting">
            {greeting ? (
              <>
                {greeting.prefix} <em>{greeting.word}</em>
              </>
            ) : (
              " "
            )}
          </div>
          <div className="dash-subtitle">
            Visão geral do seu desempenho e atividades
          </div>
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
