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
    muted: v("--vx-muted"),
    border: v("--vx-border"),
    accent: v("--vx-accent"),
    green: v("--vx-green"),
    blue: v("--vx-blue"),
    gold: v("--vx-gold"),
    fontSans: v("--font-inter") || "sans-serif",
    fontMono: v("--font-jetbrains") || "monospace",
  };
}
