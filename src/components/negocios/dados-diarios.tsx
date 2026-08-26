"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chart } from "chart.js";
import { getChartStyle } from "@/lib/chart";
import { useTheme } from "@/components/theme-provider";
import { moeda, moedaCurta, type PontoDia } from "@/lib/financeiro";
import {
  areaVertical,
  CURVA_HONESTA,
  comAlfa as alfa,
  gradienteHorizontal,
  pluginBaseEPico,
  pluginCursorVertical,
  pluginRotuloNaPonta,
  raioAncora,
  tracoDuplo,
} from "@/lib/chart-linha";

export type SerieId = "criado" | "ganho" | "perdido";
export type Modo = "valor" | "qtd";

// Verde e vermelho ficam porque aqui eles SIGNIFICAM: ganho e perda. Já
// "criado" não tem cor natural — era --mk-blue, um matiz que não dizia nada e
// que vinha de uma segunda paleta. Passa a sair da rampa, a mesma da rosca.
const SERIES: ReadonlyArray<{ id: SerieId; label: string; cor: string }> = [
  { id: "criado", label: "Criados", cor: "--mk-cat-1" },
  { id: "ganho", label: "Ganhos", cor: "--mk-green" },
  { id: "perdido", label: "Perdidos", cor: "--mk-red" },
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
    const reduzirMovimento = () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const est = getChartStyle();

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: dados.rotulos,
        datasets: dados.series.flatMap((s) => {
          const cor = lerVar(s.cor) || est.accent;
          const protagonista = destaque === s.id;
          const apagado = !protagonista;
          const base = {
            label: s.label,
            data: s.valores,
            // Gradiente ao longo do X: claro no passado, cheio no presente.
            // Profundidade sem massa — e diz para que lado o tempo corre.
            // A FUNÇÃO vai direto: o Chart.js a chama com o contexto real, já
            // com a área do gráfico calculada. Chamá-la aqui daria um gradiente
            // de largura zero, porque no primeiro passe o layout ainda não
            // aconteceu.
            borderColor: protagonista
              ? gradienteHorizontal(cor)
              : alfa(est.muted, 0.45),
            // Ponto só nas âncoras (último, máximo, mínimo) e só na
            // protagonista: ponto na linha de contexto vira ruído.
            pointRadius: protagonista ? raioAncora(s.valores) : 0,
            pointHoverRadius: 4,
            pointBackgroundColor: cor,
            pointBorderWidth: 0,
            pointHoverBackgroundColor: cor,
            pointHoverBorderColor: est.border,
            ...CURVA_HONESTA,
            // ÁREA só na protagonista, e a 10% no topo indo a 0 na base. O
            // erro antigo eram TRÊS áreas somando quase um terço de pixels
            // escuros; uma sozinha a 10% dá corpo sem peso.
            fill: protagonista ? "origin" : false,
            backgroundColor: protagonista ? areaVertical(cor) : undefined,
          };
          // Traço duplo: 6px a 8% atrás, sólido na frente. A de contexto não
          // ganha halo — ela já está recuando.
          return protagonista
            ? tracoDuplo(base, cor, 2)
            : [{ ...base, borderWidth: 1, order: 3 }];
        }),
      },
      // Os plugins ficam nesta instância, não registrados global: o rótulo na
      // ponta e o cursor não devem vazar para a rosca nem para os outros
      // gráficos.
      plugins: [
        pluginRotuloNaPonta(
          (v) => (modo === "valor" ? moedaCurta(v) : String(v)),
          est.fontSans,
          est.fontMono,
          est.muted
        ),
        pluginBaseEPico(
          (v) => (modo === "valor" ? moedaCurta(v) : String(v)),
          est.border,
          est.muted,
          est.fontMono
        ),
        pluginCursorVertical(est.border),
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        // 200ms na troca de protagonista: rápido o bastante para parecer
        // resposta, lento o bastante para o olho acompanhar qual linha subiu.
        // Quem pediu menos movimento recebe zero — a troca continua
        // acontecendo, só sem a transição.
        animation: { duration: reduzirMovimento() ? 0 : 200 },
        // Espaço à direita para o rótulo da ponta caber sem sair da área.
        layout: { padding: { right: 96 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            // Superfície + texto2 + borda2 (não --mk-border como fundo, que
            // deixava a caixa sem contorno e o texto no limite do contraste).
            backgroundColor: lerVar("--mk-surface2"),
            titleColor: lerVar("--mk-text"),
            bodyColor: lerVar("--mk-text2"),
            borderColor: lerVar("--mk-border2"),
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
          // A CALHA DO Y SAIU. Eram ~60px de largura ocupados só por
          // "R$ 6 mil / R$ 4 mil / R$ 2 mil / R$ 0,00" — quatro números que
          // ninguém lê, roubando espaço da própria plotagem. Fica UMA linha de
          // base no zero, e o valor do PICO flutua junto do pico (plugin
          // abaixo), que é o único número do eixo que alguém procura.
          y: {
            beginAtZero: true,
            grid: { display: false },
            border: { display: false },
            ticks: { display: false },
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
