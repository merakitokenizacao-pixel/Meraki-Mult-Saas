"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  useAgendamentosComLead,
  useLeads,
  useCatalogoServicos,
  useLeadsQueResponderam,
} from "@/lib/hooks";
import { MetricsGrid } from "@/components/dashboard/metrics-grid";
import { ProximosAgendamentos } from "@/components/dashboard/proximos-agendamentos";
import { Funnel } from "@/components/dashboard/funnel";
import { ServiceChart } from "@/components/dashboard/service-chart";
import { TimelineChart } from "@/components/dashboard/timeline-chart";
import { LeadModal } from "@/components/clientes/lead-modal";
import type { Lead } from "@/types/db";

function Spinner() {
  return (
    <div className="loading">
      <div className="spinner" />
    </div>
  );
}

// Conteúdo da aba "Multiatendimento". A saudação, o filtro de período e as
// abas vivem no container (`visao-geral.tsx`) — daí `period` chegar por prop:
// as duas abas compartilham o MESMO recorte, e trocar de aba não o perde.
export function Dashboard({ period }: { period: string }) {
  const leadsQuery = useLeads();
  // Separa quem chegou de quem só recebeu disparo — ver o comentário em
  // metrics-grid.tsx.
  const responderamQuery = useLeadsQueResponderam();
  const responderam = responderamQuery.data ?? null;

  // Preço vem do catálogo da clínica — a MESMA base que a agente lê. Mesmo
  // hook da aba Negócios, então nenhuma requisição a mais: mesma queryKey.
  const catalogoQ = useCatalogoServicos();
  const precos = useMemo(
    () => ({
      catalogo: catalogoQ.data?.servicos ?? [],
      promocoes: catalogoQ.data?.promocoes ?? [],
    }),
    [catalogoQ.data]
  );
  // Uma única busca de agendamentos. Antes esta tela pedia a MESMA tabela duas
  // vezes na mesma renderização (useAgendamentos + useAgendamentosComLead),
  // com queryKeys diferentes, então nem o cache aproveitava. Como
  // AgendamentoComLead estende Agendamento, a versão com join serve os dois
  // usos: só ela traz o nome do cliente, que "Próximos agendamentos" precisa.
  const agendComLeadQuery = useAgendamentosComLead();
  const leads = leadsQuery.data ?? [];
  const agendComLead = agendComLeadQuery.data ?? [];
  const agendamentos = agendComLead;
  const loading = leadsQuery.isPending;

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  return (
    <>
      {/* Métricas */}
      {loading ? (
        <div className="metrics-grid">
          <Spinner />
        </div>
      ) : (
        <MetricsGrid
          leads={leads}
          agendamentos={agendamentos}
          period={period}
          responderam={responderam}
          precos={precos}
        />
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
            <Funnel
              leads={leads}
              agendamentos={agendamentos}
              responderam={responderam}
            />
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
    </>
  );
}
