"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAgendamentos, useAgendamentosComLead, useLeads } from "@/lib/hooks";
import { MetricsGrid } from "@/components/dashboard/metrics-grid";
import { ProximosAgendamentos } from "@/components/dashboard/proximos-agendamentos";
import { Funnel } from "@/components/dashboard/funnel";
import { ServiceChart } from "@/components/dashboard/service-chart";
import { TimelineChart } from "@/components/dashboard/timeline-chart";
import { LeadModal } from "@/components/clientes/lead-modal";
import type { Lead } from "@/types/db";

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
  const leadsQuery = useLeads();
  const agendamentosQuery = useAgendamentos();
  const agendComLeadQuery = useAgendamentosComLead();
  const leads = leadsQuery.data ?? [];
  const agendamentos = agendamentosQuery.data ?? [];
  const agendComLead = agendComLeadQuery.data ?? [];
  const loading = leadsQuery.isPending;

  const [period, setPeriod] = useState("hoje");
  const [greeting, setGreeting] = useState<{ prefix: string; word: string } | null>(
    null
  );
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(
      h < 12
        ? { prefix: "Bom", word: "dia" }
        : h < 18
          ? { prefix: "Boa", word: "tarde" }
          : { prefix: "Boa", word: "noite" }
    );
  }, []);

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

      {/* Próximos agendamentos + Funil */}
      <div className="section-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Próximos agendamentos</span>
            <Link href="/agenda" className="card-action">
              Ver agenda →
            </Link>
          </div>
          {loading || agendComLeadQuery.isPending ? (
            <Spinner />
          ) : (
            <ProximosAgendamentos
              agendamentos={agendComLead}
              onLeadClick={(leadId) =>
                setSelectedLead(leads.find((l) => l.id === leadId) ?? null)
              }
            />
          )}
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

      <LeadModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  );
}
