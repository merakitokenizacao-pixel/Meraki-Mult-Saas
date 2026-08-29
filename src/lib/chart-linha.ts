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
 * Rótulo da série na PONTA da linha — só o NOME.
 *
 * Substitui a legenda: o olho lê o nome onde a linha termina, sem a ida e
 * volta até uma caixinha de cores.
 *
 * ⚠️ O VALOR SAIU EM AGO/2026, junto com a volta do eixo Y. Ele estava ali
 * porque não havia calha nenhuma — sem eixo, o único jeito de ler grandeza era
 * pendurar o número na ponta. Com o eixo de volta, o valor na margem passa a
 * ser a terceira grafia do mesmo número (eixo, ponta e tooltip) e era ele que
 * fazia duas séries terminando perto disputarem espaço com a própria linha.
 *
 * ⚠️ A primeira versão disto ESTAVA QUEBRADA — os rótulos se sobrepunham e
 * vazavam pela borda direita do card. Ficou pior que a legenda que substituiu.
 * Duas correções, que continuam valendo:
 *
 * 1. O ESPAÇO é reservado no `layout.padding.right` do gráfico, então a linha
 *    termina antes e o texto cabe dentro da área. Nada desenha fora.
 * 2. Colisão resolvida em uma passada: ordena por y, empurra para baixo quem
 *    estiver perto demais, e se o último passar do limite inferior sobe o
 *    conjunto inteiro na mesma medida — senão o de baixo sai pelo rodapé.
 */
export function pluginRotuloNaPonta(
  fonteSans: string,
  corContexto: string
): Plugin<"line"> {
  const ALTURA = 12; // só o nome
  const FOLGA = 4;
  return {
    id: "rotulo-na-ponta",
    afterDatasetsDraw(chart: Chart<"line">) {
      const { ctx, chartArea } = chart;

      type Rot = { y: number; nome: string; x: number };
      const rots: Rot[] = [];
      chart.data.datasets.forEach((ds, i) => {
        const rotulo = String(ds.label ?? "");
        if (rotulo.endsWith("__halo")) return; // o halo não recebe rótulo
        const meta = chart.getDatasetMeta(i);
        if (meta.hidden || meta.data.length === 0) return;
        const ultimo = meta.data[meta.data.length - 1];
        rots.push({ y: ultimo.y, nome: rotulo, x: ultimo.x + 8 });
      });
      if (rots.length === 0) return;

      // Empurra para baixo quem colide, de cima para baixo.
      rots.sort((a, b) => a.y - b.y);
      for (let k = 1; k < rots.length; k++) {
        const min = rots[k - 1].y + ALTURA + FOLGA;
        if (rots[k].y < min) rots[k].y = min;
      }
      // Se o último estourou embaixo, sobe todos na mesma medida — assim a
      // ordem relativa se mantém e ninguém sai do card.
      const excesso = rots[rots.length - 1].y + ALTURA / 2 - chartArea.bottom;
      if (excesso > 0) for (const r of rots) r.y -= excesso;
      const faltaEmCima = chartArea.top - (rots[0].y - ALTURA / 2);
      if (faltaEmCima > 0) for (const r of rots) r.y += faltaEmCima;

      ctx.save();
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillStyle = corContexto;
      ctx.font = `10px ${fonteSans}`;
      for (const r of rots) ctx.fillText(r.nome, r.x, r.y);
      ctx.restore();
    },
  };
}

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

/**
 * Área sob a linha, em gradiente VERTICAL: 10% junto do traço, 0 na base.
 *
 * Só na protagonista. O erro antigo eram TRÊS áreas empilhadas somando quase
 * um terço de pixels escuros do canvas — uma sozinha a 10% dá corpo sem peso.
 */
export function areaVertical(cor: string) {
  return (ctx: ScriptableContext<"line">): string | CanvasGradient => {
    const { chart } = ctx;
    const area = chart.chartArea;
    if (!area) return "transparent";
    const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, comAlfa(cor, 0.1));
    g.addColorStop(1, comAlfa(cor, 0));
    return g;
  };
}

/**
 * A linha de base no zero, mais forte que a grade.
 *
 * ⚠️ ISTO JÁ FOI `base-e-pico`, e desenhava também o valor do PICO flutuando
 * junto do ponto máximo. Aquilo era o SUBSTITUTO da calha do eixo Y, que tinha
 * sido removida: sem eixo, o máximo era o único número de grandeza na tela.
 * Com o eixo de volta em ago/2026 o pico virou número solto — o eixo já diz a
 * escala e o tooltip já diz o valor exato do ponto sob o cursor.
 *
 * O zero continua sendo desenhado à mão, e não pela grade: ele é a referência,
 * não mais uma divisão. Em `--mk-linha` contra a grade em `--mk-linha-suave`.
 */
export function pluginLinhaBase(corLinha: string): Plugin<"line"> {
  return {
    id: "linha-base",
    beforeDatasetsDraw(chart: Chart<"line">) {
      const { ctx, chartArea, scales } = chart;
      const y0 = scales.y?.getPixelForValue(0);
      if (y0 == null) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y0);
      ctx.lineTo(chartArea.right, y0);
      ctx.lineWidth = 1;
      ctx.strokeStyle = corLinha;
      ctx.stroke();
      ctx.restore();
    },
  };
}
