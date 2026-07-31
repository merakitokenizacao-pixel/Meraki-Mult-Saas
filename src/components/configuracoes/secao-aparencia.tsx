"use client";

import { Check, Contrast, Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { TEMAS, type Tema } from "@/lib/tema";

// As opções vêm do catálogo (lib/tema.ts) — tema novo lá aparece aqui sozinho.
// Só o ícone mora nesta camada, que é a única que desenha.
const ICONES: Record<Tema, LucideIcon> = {
  light: Sun,
  dark: Moon,
  graphite: Contrast,
};

export function SecaoAparencia() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="config-card">
      <div className="tema-grid">
        {TEMAS.map((t) => {
          const Icon = ICONES[t.id];
          const ativo = theme === t.id;
          const p = t.previa;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`tema-opcao${ativo ? " active" : ""}`}
              aria-pressed={ativo}
            >
              {/* Miniatura pintada com as cores reais do tema (literais: o
                  cartão precisa mostrar o tema que NÃO está aplicado). */}
              <div
                className="tema-preview"
                style={{ background: p.bg, borderColor: p.border }}
              >
                <div
                  className="tema-preview-bar"
                  style={{ background: p.surface, borderColor: p.border }}
                >
                  <span className="tema-preview-dot" style={{ background: p.accent }} />
                  <span className="tema-preview-line" style={{ background: p.border }} />
                </div>
                <div
                  className="tema-preview-card"
                  style={{ background: p.surface, borderColor: p.border }}
                >
                  <span className="tema-preview-line short" style={{ background: p.accent }} />
                  <span className="tema-preview-line" style={{ background: p.border }} />
                  <div className="tema-preview-cores">
                    {p.cores.map((c) => (
                      <span key={c} className="tema-preview-cor" style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="tema-info">
                <div className="tema-nome">
                  <Icon size={15} strokeWidth={1.6} />
                  {t.label}
                  {ativo && <Check size={14} strokeWidth={2.5} className="tema-check" />}
                </div>
                <div className="tema-desc">{t.descricao}</div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="config-nota">
        A preferência fica salva neste navegador. A ficha que a cliente recebe
        pelo WhatsApp <strong>não</strong> segue este tema — ela é sempre clara,
        com a identidade da clínica.
      </p>
    </div>
  );
}
