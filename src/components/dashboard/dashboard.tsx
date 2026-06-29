"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAgendamentos, getLeads } from "@/lib/queries";
import { showToast } from "@/lib/toast";
import { MetricsGrid } from "@/components/dashboard/metrics-grid";
import { RecentLeads } from "@/components/dashboard/recent-leads";
import { Funnel } from "@/components/dashboard/funnel";
import { ServiceChart } from "@/components/dashboard/service-chart";
import { TimelineChart } from "@/components/dashboard/timeline-chart";
import type { Agendamento, Lead } from "@/types/db";

const PERIODS: ReadonlyArray<[string, string]> = [
  ["hoje", "Hoje"],
  ["ontem", "Ontem"],
  ["semana", "Semana"],
  ["mes", "Mês"],
  ["tudo", "Tudo"],
];

function Spinner() {
  return (
    <div className="loading">
      <div className="spinner" />
    </div>
  );
}

export function Dashboard() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [period, setPeriod] = useState("hoje");
  const [greeting, setGreeting] = useState<{ prefix: string; word: string } | null>(
    null
  );

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(
      h < 12
        ? { prefix: "Bom", word: "dia" }
        : h < 18
          ? { prefix: "Boa", word: "tarde" }
          : { prefix: "Boa", word: "noite" }
    );

    (async () => {
      try {
        const [l, a] = await Promise.all([getLeads(), getAgendamentos()]);
        setLeads(l);
        setAgendamentos(a);
      } catch {
        setLeads([]);
        showToast("Erro ao carregar o dashboard.", "error");
      }
    })();
  }, []);

  const loading = leads === null;

  return (
    <div className="page-fade">
      {/* Header */}
      <div className="dash-header">
        <div>
          <div className="dash-greeting">
            {greeting ? (
              <>
                {greeting.prefix} <em>{greeting.word}</em>
              </>
            ) : (
              " "
            )}
          </div>
          <div className="dash-subtitle">Visão geral · VoraX</div>
        </div>
        <div className="filter-bar">
          {PERIODS.map(([value, label]) => (
            <button
              key={value}
              className={`filter-btn${period === value ? " active" : ""}`}
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Métricas */}
      {loading ? (
        <div className="metrics-grid">
          <Spinner />
        </div>
      ) : (
        <MetricsGrid leads={leads} agendamentos={agendamentos} period={period} />
      )}

      {/* Clientes recentes + Funil */}
      <div className="section-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Clientes recentes</span>
            <Link href="/clientes" className="card-action">
              Ver todos →
            </Link>
          </div>
          {loading ? <Spinner /> : <RecentLeads leads={leads} />}
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Funil de conversão</span>
          </div>
          {loading ? (
            <Spinner />
          ) : (
            <Funnel leads={leads} agendamentos={agendamentos} />
          )}
        </div>
      </div>

      {/* Gráficos */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Serviços mais agendados</span>
          </div>
          <ServiceChart agendamentos={agendamentos} />
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Novos clientes por dia</span>
          </div>
          <TimelineChart leads={loading ? [] : leads} />
        </div>
      </div>
    </div>
  );
}
