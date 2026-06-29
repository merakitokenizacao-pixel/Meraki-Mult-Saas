"use client";

import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { getChartStyle } from "@/lib/chart";
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
      {
        data: Object.values(days),
        borderColor: cs.accent,
        backgroundColor: cs.accent + "18",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: cs.accent,
        borderWidth: 2,
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
