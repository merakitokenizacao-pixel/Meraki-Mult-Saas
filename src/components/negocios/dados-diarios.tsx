"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chart } from "chart.js";
import { getChartStyle } from "@/lib/chart";
import { useTheme } from "@/components/theme-provider";
import { moeda, moedaCurta, type PontoDia } from "@/lib/financeiro";

export type SerieId = "criado" | "ganho" | "perdido";
export type Modo = "valor" | "qtd";

const SERIES: ReadonlyArray<{ id: SerieId; label: string; cor: string }> = [
  { id: "criado", label: "Criados", cor: "--vx-blue" },
  { id: "ganho", label: "Ganhos", cor: "--vx-green" },
  { id: "perdido", label: "Perdidos", cor: "--vx-red" },
];

function lerVar(nome: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

/** rgba a partir de #rrggbb — para a área abaixo da linha. */
function comAlfa(hex: string, alfa: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

export function DadosDiarios({
  pontos,
  modo,
  destaque,
}: {
  pontos: PontoDia[];
  modo: Modo;
  /** Card selecionado lá em cima: a série correspondente ganha peso e as
   *  outras recuam. Sem isso a borda acesa do card não teria função. */
  destaque: SerieId | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const { theme } = useTheme();

  // Gate de montagem: getComputedStyle não existe no servidor, e a rota é
  // pré-renderizada.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const dados = useMemo(
    () => ({
      rotulos: pontos.map((p) => p.rotulo),
      series: SERIES.map((s) => ({
        ...s,
        valores: pontos.map((p) => (modo === "valor" ? p[s.id].valor : p[s.id].qtd)),
      })),
    }),
    [pontos, modo]
  );

  useEffect(() => {
    if (!montado || !canvasRef.current) return;
    const est = getChartStyle();

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: dados.rotulos,
        datasets: dados.series.map((s) => {
          const cor = lerVar(s.cor) || est.accent;
          const apagado = destaque !== null && destaque !== s.id;
          return {
            label: s.label,
            data: s.valores,
            borderColor: apagado ? comAlfa(cor, 0.28) : cor,
            borderWidth: destaque === s.id ? 2.4 : 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: cor,
            pointHoverBorderColor: est.border,
            tension: 0.35,
            // Sem área. As três séries não somam entre si — preencher embaixo
            // insinua acúmulo onde não há, e o empilhamento das três era o
            // maior bloco de cor da tela.
            fill: false,
            order: destaque === s.id ? 0 : 1,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            // Superfície + texto2 + borda2 (não --vx-border como fundo, que
            // deixava a caixa sem contorno e o texto no limite do contraste).
            backgroundColor: lerVar("--vx-surface2"),
            titleColor: lerVar("--vx-text"),
            bodyColor: lerVar("--vx-text2"),
            borderColor: lerVar("--vx-border2"),
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            titleFont: { family: est.fontSans, size: 11, weight: 600 },
            bodyFont: { family: est.fontMono, size: 11 },
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
            usePointStyle: true,
            callbacks: {
              label: (ctx) => {
                const y = ctx.parsed.y ?? 0;
                return ` ${ctx.dataset.label}: ${
                  modo === "valor" ? moeda(y) : `${y}`
                }`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: est.muted,
              font: { family: est.fontMono, size: 10 },
              maxRotation: 0,
              autoSkipPadding: 18,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: est.border },
            border: { display: false },
            ticks: {
              color: est.muted,
              font: { family: est.fontMono, size: 10 },
              maxTicksLimit: 5,
              callback: (v) =>
                modo === "valor" ? moedaCurta(Number(v)) : `${v}`,
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // `theme` entra nas dependências para o gráfico reler as CSS vars ao
    // alternar Claro/Escuro/Grafite — Chart.js pinta em canvas e não herda CSS.
  }, [montado, dados, modo, destaque, theme]);

  return (
    <div className="neg-gr-area">
      {montado ? (
        <canvas ref={canvasRef} aria-label="Movimento diário" role="img" />
      ) : null}
    </div>
  );
}

export function LegendaSeries({
  destaque,
  onDestacar,
}: {
  destaque: SerieId | null;
  onDestacar: (s: SerieId | null) => void;
}) {
  return (
    <div className="neg-legenda">
      {SERIES.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onDestacar(destaque === s.id ? null : s.id)}
          className={`neg-legenda-item${destaque === s.id ? " ativo" : ""}`}
          aria-pressed={destaque === s.id}
        >
          <span
            className="neg-legenda-ponto"
            style={{ background: `var(${s.cor})` }}
          />
          {s.label}
        </button>
      ))}
    </div>
  );
}
