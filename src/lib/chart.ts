// Registro do Chart.js e leitura das cores do tema (espelha getChartStyle do legacy).
import {
  Chart as ChartJS,
  ArcElement,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
  DoughnutController,
  LineController,
} from "chart.js";

ChartJS.register(
  ArcElement,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
  DoughnutController,
  LineController
);

export interface ChartStyle {
  muted: string;
  border: string;
  accent: string;
  green: string;
  blue: string;
  gold: string;
  fontSans: string;
  fontMono: string;
}

// Lê as variáveis CSS atuais (reagem ao data-theme). Só roda no cliente.
export function getChartStyle(): ChartStyle {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    muted: v("--mk-muted"),
    border: v("--mk-border"),
    accent: v("--mk-accent"),
    green: v("--mk-green"),
    blue: v("--mk-blue"),
    gold: v("--mk-gold"),
    fontSans: v("--font-inter") || "sans-serif",
    fontMono: v("--font-jetbrains") || "monospace",
  };
}
