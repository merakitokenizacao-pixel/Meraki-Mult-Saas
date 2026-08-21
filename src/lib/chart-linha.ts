// Tratamento visual das linhas — compartilhado entre "Dados diários" e "Novos
// clientes por dia", para os dois não divergirem com o tempo.
//
// Quatro movimentos, e nenhum deles adiciona massa à tela:
//
// 1. GRADIENTE NO TRAÇO. A linha escurece em direção ao dado recente. Dá
//    profundidade sem acrescentar peso — e diz, sem legenda, para que lado o
//    tempo corre.
// 2. TRAÇO DUPLO no lugar de sombra. O mesmo caminho duas vezes: 6px a 8% atrás,
//    2px sólido na frente. Lê como profundidade suave; `shadowBlur` lê como
//    neon e ainda custa uma passada de blur por quadro.
// 3. RÓTULO NA PONTA. O nome da série ao lado do último ponto elimina a ida e
//    volta até a legenda — e elimina a própria caixa, que é o elemento mais
//    burocrático do card.
// 4. PONTO SÓ ONDE IMPORTA: último, máximo e mínimo. Ponto em tudo vira ruído;
//    ponto em nada tira a âncora.

import type { Chart, ChartDataset, Plugin, ScriptableContext } from "chart.js";

/**
 * ⚠️ A CURVA NÃO PODE ULTRAPASSAR O DADO.
 *
 * `tension` no Chart.js usa interpolação cúbica que EXTRAPOLA: entre dois
 * pontos a curva sobe acima do maior deles e desce abaixo do menor. Era visível
 * em "Novos clientes por dia" — a linha subia acima do último ponto e voltava,
 * inventando um pico que não existe em lugar nenhum.
 *
 * `cubicInterpolationMode: "monotone"` é o curveMonotoneX: suaviza igual, mas é
 * matematicamente proibido de passar dos valores reais. Mesma elegância, sem
 * mentir. Por isso `tension` sai junto — os dois brigam.
 */
export const CURVA_HONESTA = {
  cubicInterpolationMode: "monotone" as const,
  tension: 0,
};

/** Índices que merecem ponto: último, máximo e mínimo. */
export function indicesAncora(valores: number[]): Set<number> {
  const fora = new Set<number>();
  if (valores.length === 0) return fora;
  let iMax = 0;
  let iMin = 0;
  for (let i = 1; i < valores.length; i++) {
    if (valores[i] > valores[iMax]) iMax = i;
    if (valores[i] < valores[iMin]) iMin = i;
  }
  fora.add(valores.length - 1);
  fora.add(iMax);
  fora.add(iMin);
  return fora;
}

/** Raio do ponto, ponto a ponto. Só as âncoras aparecem. */
export function raioAncora(valores: number[]) {
  const ancoras = indicesAncora(valores);
  return (ctx: ScriptableContext<"line">) =>
    ancoras.has(ctx.dataIndex) ? 3.5 : 0;
}

/** `#rrggbb` + alfa → rgba. */
export function comAlfa(hex: string, alfa: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

/**
 * Gradiente ao longo do eixo X: claro no passado, cheio no presente.
 *
 * Devolve uma função porque a área do gráfico só existe DEPOIS do primeiro
 * layout — chamar `createLinearGradient` na montagem daria erro ou um gradiente
 * de largura zero.
 */
export function gradienteHorizontal(cor: string, opacidadeInicial = 0.35) {
  return (ctx: ScriptableContext<"line">): string | CanvasGradient => {
    const { chart } = ctx;
    const area = chart.chartArea;
    if (!area) return cor; // primeiro passe, antes do layout
    const g = chart.ctx.createLinearGradient(area.left, 0, area.right, 0);
    g.addColorStop(0, comAlfa(cor, opacidadeInicial));
    g.addColorStop(1, cor);
    return g;
  };
}

/**
 * O par de datasets que forma o traço duplo.
 *
 * O de trás vem PRIMEIRO no array e com `order` maior: no Chart.js, `order`
 * alto desenha antes, então ele fica atrás. Ele não participa do tooltip
 * (`tooltip: false`) — senão cada série apareceria duas vezes na caixa.
 */
export function tracoDuplo(
  base: ChartDataset<"line", number[]>,
  cor: string,
  espessura = 2
): ChartDataset<"line", number[]>[] {
  return [
    {
      ...base,
      label: `${base.label ?? ""}__halo`,
      borderColor: comAlfa(cor, 0.08),
      borderWidth: espessura * 3,
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
      order: 10,
      // @ts-expect-error — a tipagem do Chart.js não expõe isto por dataset.
      tooltip: { callbacks: { label: () => null } },
    },
    { ...base, borderWidth: espessura, order: 1 },
  ];
}

/**
 * Rótulo da série na PONTA da linha + o último valor.
 *
 * Substitui a legenda: o olho lê o nome onde a linha termina, sem a ida e volta
 * até uma caixinha de cores.
 */
export function pluginRotuloNaPonta(
  formatar: (v: number) => string,
  fonteSans: string,
  fonteMono: string
): Plugin<"line"> {
  return {
    id: "rotulo-na-ponta",
    afterDatasetsDraw(chart: Chart<"line">) {
      const { ctx } = chart;
      ctx.save();
      chart.data.datasets.forEach((ds, i) => {
        const rotulo = String(ds.label ?? "");
        // O halo não recebe rótulo — senão sai escrito duas vezes.
        if (rotulo.endsWith("__halo")) return;
        const meta = chart.getDatasetMeta(i);
        if (meta.hidden) return;
        const pontos = meta.data;
        if (pontos.length === 0) return;
        const ultimo = pontos[pontos.length - 1];
        const valor = Number(ds.data[ds.data.length - 1] ?? 0);
        const cor =
          typeof ds.borderColor === "string" ? ds.borderColor : "currentColor";

        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        const x = ultimo.x + 8;
        ctx.fillStyle = cor;
        ctx.font = `500 10.5px ${fonteSans}`;
        ctx.fillText(rotulo, x, ultimo.y - 6);
        ctx.font = `600 11px ${fonteMono}`;
        ctx.fillText(formatar(valor), x, ultimo.y + 7);
      });
      ctx.restore();
    },
  };
}

/**
 * Linha vertical seguindo o cursor.
 *
 * É o que separa gráfico de relatório de gráfico de produto: com
 * `interaction.mode = "index"` os três valores do dia já aparecem juntos no
 * tooltip; a vertical é o que amarra a caixa ao dia que ela descreve.
 */
export function pluginCursorVertical(cor: string): Plugin<"line"> {
  return {
    id: "cursor-vertical",
    beforeDatasetsDraw(chart: Chart<"line">) {
      const ativos = chart.getActiveElements();
      if (ativos.length === 0) return;
      const { ctx, chartArea } = chart;
      const x = ativos[0].element.x;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = cor;
      ctx.stroke();
      ctx.restore();
    },
  };
}
