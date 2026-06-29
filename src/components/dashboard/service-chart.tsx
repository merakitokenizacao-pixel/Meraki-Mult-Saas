"use client";

import { useEffect, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { getChartStyle } from "@/lib/chart";
import { limparServico } from "@/lib/format";
import { useTheme } from "@/components/theme-provider";
import type { Agendamento } from "@/types/db";

// Replica renderServiceChart: doughnut dos serviços mais agendados (top 6).
export function ServiceChart({ agendamentos }: { agendamentos: Agendamento[] }) {
  useTheme(); // re-renderiza ao trocar o tema, recalculando as cores
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="chart-container" />;

  const svcs: Record<string, number> = {};
  agendamentos.forEach((a) => {
    if (a.servico) {
      const s = limparServico(a.servico);
      svcs[s] = (svcs[s] || 0) + 1;
    }
  });
  const sorted = Object.entries(svcs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (sorted.length === 0) return <div className="chart-container" />;

  const cs = getChartStyle();
  const colors = [cs.accent, cs.green, cs.blue, cs.gold, "#6c5ce7", "#e74c3c"];

  const data: ChartData<"doughnut"> = {
    labels: sorted.map((s) => s[0]),
    datasets: [
      {
        data: sorted.map((s) => s[1]),
        backgroundColor: colors.slice(0, sorted.length),
        borderWidth: 0,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: cs.muted,
          font: { family: cs.fontSans, size: 11 },
          padding: 12,
          usePointStyle: true,
          pointStyleWidth: 8,
        },
      },
    },
    cutout: "65%",
  };

  return (
    <div className="chart-container">
      <Doughnut data={data} options={options} />
    </div>
  );
}
