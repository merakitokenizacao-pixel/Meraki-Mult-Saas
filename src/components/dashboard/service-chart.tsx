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
  // Ordena por volume e agrupa a CAUDA em "Outros". O `slice(0,6)` de antes
  // descartava o resto em silêncio — a rosca somava menos que o total de
  // atendimentos e ninguém via. E juntar a cauda é o que permite ficar dentro
  // dos cinco tons da rampa, sem voltar para o arco-íris só porque há mais
  // categorias que cores.
  const todos = Object.entries(svcs).sort((a, b) => b[1] - a[1]);
  const TOPO = 4;
  const cauda = todos.slice(TOPO);
  const somaCauda = cauda.reduce((n, [, v]) => n + v, 0);
  const sorted: [string, number][] =
    somaCauda > 0
      ? [...todos.slice(0, TOPO), [`Outros (${cauda.length})`, somaCauda]]
      : todos.slice(0, TOPO);

  if (sorted.length === 0) return <div className="chart-container" />;

  const cs = getChartStyle();
  // A MESMA rampa da rosca "Percentual por profissional". Duas roscas na
  // mesma página com linguagens de cor diferentes é o que fazia uma delas
  // parecer de outro aplicativo.
  const raiz = getComputedStyle(document.documentElement);
  const colors = [1, 2, 3, 4, 5].map((i) =>
    raiz.getPropertyValue(`--mk-cat-${i}`).trim()
  );

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
