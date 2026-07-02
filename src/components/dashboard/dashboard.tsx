"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAgendamentosComLead, getLeads } from "@/lib/queries";
import { showToast } from "@/lib/toast";
import { MetricsGrid } from "@/components/dashboard/metrics-grid";
import { ProximosAgendamentos } from "@/components/dashboard/proximos-agendamentos";
import { Funnel } from "@/components/dashboard/funnel";
import { ServiceChart } from "@/components/dashboard/service-chart";
import { TimelineChart } from "@/components/dashboard/timeline-chart";
import type { AgendamentoComLead, Lead } from "@/types/db";

function Spinner() {
  return (
    <div className="loading">
      <div className="spinner" />
    </div>
  );
}

export function Dashboard() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [agendamentos, setAgendamentos] = useState<AgendamentoComLead[]>([]);
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
        // Dois fetches: leads (funil/timeline/KPIs) e agendamentos com lead
        // (serviços/funil/KPIs de retenção/próximos). Tudo derivado em memória
        // a partir desses dois conjuntos — evita round-trips extras.
        const [l, a] = await Promise.all([getLeads(), getAgendamentosComLead()]);
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
              " "
            )}
          </div>
          <div className="dash-subtitle">Visão geral · VoraX</div>
        </div>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="metrics-grid">
          <Spinner />
        </div>
      ) : (
        <MetricsGrid leads={leads} agendamentos={agendamentos} />
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
          {loading ? (
            <Spinner />
          ) : (
            <ProximosAgendamentos agendamentos={agendamentos} />
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
    </div>
  );
}
