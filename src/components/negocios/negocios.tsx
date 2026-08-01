"use client";

import { CalendarClock, RotateCcw, TrendingUp, UserPlus } from "lucide-react";
import { useAgendamentosComLead, useLeads } from "@/lib/hooks";
import { filterByDate } from "@/lib/date";
import { KpiCard } from "@/components/negocios/kpi-card";
import { ServicosVendidos } from "@/components/negocios/servicos-vendidos";

// Aba "Negócios" — a tela onde o layout novo está sendo testado.
//
// Os hooks são chamados aqui e também no Dashboard (a outra aba). Não é fetch
// duplicado: as queryKeys são as mesmas, então o React Query serve as duas do
// mesmo cache com uma requisição só.
//
// SOBRE OS NÚMEROS: três dos quatro cards saem de dado real. "Receita
// recuperada" não tem origem no banco ainda (dependeria dos follow-ups
// fecharem venda) e `agendamentos.valor` está 100% vazio — o n8n não preenche.
// Por isso ela aparece marcada como "sem fonte" em vez de um R$ 0,00 que se
// leria como informação verdadeira.

export function Negocios({ period }: { period: string }) {
  const leadsQuery = useLeads();
  const agendQuery = useAgendamentosComLead();
  const leads = leadsQuery.data ?? [];
  const agendamentos = agendQuery.data ?? [];
  const carregando = leadsQuery.isPending || agendQuery.isPending;

  // Criados: quando o lead entrou.
  const criados = filterByDate(leads, "criado_em", period).length;

  // Ganhos e serviços: quando o atendimento aconteceu.
  const doPeriodo = filterByDate(agendamentos, "data_agendamento", period);
  const realizados = doPeriodo.filter((a) => a.status === "realizado").length;

  // Em aberto NÃO é filtrado por período: "aberto" é uma situação de agora,
  // não um recorte do passado. Filtrar por período faria a caixa "Ontem"
  // mostrar zero em aberto, o que não quer dizer nada.
  const agora = Date.now();
  const emAberto = agendamentos.filter(
    (a) =>
      a.status !== "cancelado" &&
      a.status !== "realizado" &&
      new Date(a.data_agendamento).getTime() >= agora
  ).length;

  const n = (v: number) => (carregando ? "—" : String(v));

  return (
    <div className="neg-fill">
      <div className="neg-grid">
        <KpiCard
          rotulo="Total criado"
          valor={n(criados)}
          apoio="clientes novos no período"
          icone={UserPlus}
          tom="accent"
        />
        <KpiCard
          rotulo="Total ganhos"
          valor={n(realizados)}
          apoio="procedimentos realizados"
          icone={TrendingUp}
          tom="green"
        />
        <KpiCard
          rotulo="Total em aberto"
          valor={n(emAberto)}
          apoio="marcados, ainda vão acontecer"
          icone={CalendarClock}
          tom="blue"
        />
        <KpiCard
          rotulo="Receita recuperada"
          valor="—"
          apoio="follow-up que virou venda"
          icone={RotateCcw}
          tom="purple"
          semFonte
        />
      </div>

      <section className="neg-painel">
        <header className="neg-painel-topo">
          <h2 className="neg-painel-titulo">Serviços mais vendidos</h2>
          <span className="neg-painel-nota">procedimentos realizados</span>
        </header>
        {carregando ? (
          <div className="neg-vazio">Carregando…</div>
        ) : (
          <ServicosVendidos agendamentos={doPeriodo} />
        )}
      </section>
    </div>
  );
}
