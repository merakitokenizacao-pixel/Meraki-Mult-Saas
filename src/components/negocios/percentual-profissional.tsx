"use client";

import { useEffect, useRef, useState } from "react";
import { Chart } from "chart.js";
import { getChartStyle } from "@/lib/chart";
import { useTheme } from "@/components/theme-provider";
import { moeda } from "@/lib/financeiro";
import type { Modo } from "@/components/negocios/dados-diarios";
import type { FatiaProfissional } from "@/lib/atribuicao";

// Quantidade fracionária: um atendimento rateado entre 3 vale 0,33 para cada.
// Arredondar para inteiro faria as parcelas não somarem o total.
function qtdTexto(q: number): string {
  const arred = Math.round(q * 10) / 10;
  return Number.isInteger(arred) ? `${arred}` : arred.toFixed(1).replace(".", ",");
}

/** Resolve um token CSS para o valor do tema ATUAL. O canvas não herda CSS,
 *  então cor de gráfico tem que ser lida, não escrita. */
function lerVar(nome: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

// Rosca + legenda com valor. A rosca sozinha responde "quem é o maior"; a
// legenda ao lado responde "quanto", que é o que a dona vai querer saber.
export function PercentualProfissional({
  fatias,
  modo = "valor",
}: {
  fatias: FatiaProfissional[];
  modo?: Modo;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const { theme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!montado || !canvasRef.current || fatias.length === 0) return;
    const est = getChartStyle();
    const cores = fatias.map((f) => lerVar(f.token));

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: fatias.map((f) => f.nome),
        datasets: [
          {
            data: fatias.map((f) => (modo === "valor" ? f.valor : f.qtd)),
            backgroundColor: cores,
            // Borda na cor da superfície: abre respiro entre as fatias sem
            // desenhar linha nenhuma, e acompanha o tema sozinha.
            borderColor: lerVar("--vx-surface"),
            borderWidth: 3,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: { display: false },
          tooltip: {
            // Superfície + texto2 + borda2. Antes o fundo era --vx-border com
            // corpo em --vx-muted (2,7:1) e a borda igual ao próprio fundo —
            // caixa sem contorno e texto no limite da legibilidade.
            backgroundColor: lerVar("--vx-surface2"),
            titleColor: lerVar("--vx-text"),
            bodyColor: lerVar("--vx-text2"),
            borderColor: lerVar("--vx-border2"),
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            titleFont: { family: est.fontSans, size: 11, weight: 600 },
            bodyFont: { family: est.fontMono, size: 11 },
            callbacks: {
              label: (ctx) =>
                modo === "valor"
                  ? ` ${moeda(Number(ctx.parsed))}`
                  : ` ${qtdTexto(Number(ctx.parsed))} atendimento(s)`,
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [montado, fatias, modo, theme]);

  if (fatias.length === 0) {
    return <div className="neg-vazio">Nenhum atendimento realizado no período.</div>;
  }

  return (
    <div className="neg-rosca-wrap">
      <div className="neg-rosca">{montado ? <canvas ref={canvasRef} /> : null}</div>
      <ul className="neg-rosca-legenda">
        {fatias.map((f) => (
          <li key={f.nome}>
            <span
              className="neg-legenda-ponto"
              style={{ background: `var(${f.token})` }}
            />
            <span className="neg-rosca-nome">{f.nome}</span>
            <span className="neg-rosca-pct">{f.pct.toFixed(0)}%</span>
            <span className="neg-rosca-valor">
              {modo === "valor" ? moeda(f.valor) : `${qtdTexto(f.qtd)}×`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
