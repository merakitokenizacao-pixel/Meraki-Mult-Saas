"use client";

import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { getChartStyle } from "@/lib/chart";
import {
  CURVA_HONESTA,
  comAlfa,
  gradienteHorizontal,
  raioAncora,
} from "@/lib/chart-linha";
import { useTheme } from "@/components/theme-provider";
import type { Lead } from "@/types/db";

// Replica renderTimelineChart: novos clientes por dia nos últimos 7 dias.
export function TimelineChart({ leads }: { leads: Lead[] }) {
  useTheme(); // re-renderiza ao trocar o tema
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="chart-container" />;

  const days: Record<string, number> = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days[d.toISOString().split("T")[0]] = 0;
  }
  leads.forEach((l) => {
    if (l.criado_em) {
      const key = l.criado_em.split("T")[0];
      if (key in days) days[key]++;
    }
  });

  const cs = getChartStyle();

  const data: ChartData<"line"> = {
    labels: Object.keys(days).map((d) =>
      new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      })
    ),
    datasets: [
      // Traço duplo: 6px a 8% atrás, sólido na frente. Profundidade sem
      // sombra — `shadowBlur` lê como neon e custa uma passada de blur por
      // quadro.
      {
        data: Object.values(days),
        borderColor: comAlfa(cs.accent, 0.08),
        borderWidth: 6,
        pointRadius: 0,
        fill: false,
        order: 10,
        ...CURVA_HONESTA,
      },
      {
        data: Object.values(days),
        // Gradiente: claro no passado, cheio no presente.
        borderColor: gradienteHorizontal(cs.accent),
        // Sem área: com uma série só ela não soma nada, e era a maior massa
        // de cor do card.
        fill: false,
        // ⚠️ `tension` EXTRAPOLA — era ele que fazia a curva subir acima do
        // último ponto e voltar, inventando um pico que não existe no dado.
        // `monotone` suaviza igual e é proibido de passar dos valores reais.
        ...CURVA_HONESTA,
        // Ponto só no último, no máximo e no mínimo.
        pointRadius: raioAncora(Object.values(days)),
        pointHoverRadius: 5,
        pointBackgroundColor: cs.accent,
        pointBorderWidth: 0,
        borderWidth: 2,
        order: 1,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { color: cs.muted, font: { size: 10, family: cs.fontMono } },
        grid: { color: cs.border },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: cs.muted,
          font: { size: 10, family: cs.fontMono },
          stepSize: 1,
        },
        grid: { color: cs.border },
      },
    },
  };

  return (
    <div className="chart-container">
      <Line data={data} options={options} />
    </div>
  );
}
