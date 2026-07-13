"use client";

import { Check, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

// O tema já existia (toggle na topbar, persistido em localStorage). Aqui ele
// ganha um lugar explícito — e a prévia mostra o resultado antes de aplicar.
export function SecaoAparencia() {
  const { theme, toggleTheme } = useTheme();

  const opcoes = [
    {
      id: "light" as const,
      label: "Claro",
      descricao: "Bege e dourado, para o dia",
      icon: Sun,
      // Cores fixas: a prévia tem que mostrar o tema OPOSTO ao atual também.
      preview: { bg: "#f8f6f2", surface: "#ffffff", border: "#e0dbd2", text: "#1a1814", accent: "#9b7d5a" },
    },
    {
      id: "dark" as const,
      label: "Escuro",
      descricao: "Suave para o fim do expediente",
      icon: Moon,
      preview: { bg: "#111009", surface: "#1a1814", border: "#38352a", text: "#f0ece4", accent: "#c8a07a" },
    },
  ];

  return (
    <div className="config-card">
      <div className="config-grid-2">
        {opcoes.map((o) => {
          const Icon = o.icon;
          const ativo = theme === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                if (!ativo) toggleTheme();
              }}
              className={`tema-opcao${ativo ? " active" : ""}`}
              aria-pressed={ativo}
            >
              {/* Miniatura do tema, pintada com as cores reais dele */}
              <div
                className="tema-preview"
                style={{ background: o.preview.bg, borderColor: o.preview.border }}
              >
                <div
                  className="tema-preview-bar"
                  style={{ background: o.preview.surface, borderColor: o.preview.border }}
                >
                  <span className="tema-preview-dot" style={{ background: o.preview.accent }} />
                  <span className="tema-preview-line" style={{ background: o.preview.border }} />
                </div>
                <div
                  className="tema-preview-card"
                  style={{ background: o.preview.surface, borderColor: o.preview.border }}
                >
                  <span className="tema-preview-line short" style={{ background: o.preview.accent }} />
                  <span className="tema-preview-line" style={{ background: o.preview.border }} />
                  <span className="tema-preview-line" style={{ background: o.preview.border }} />
                </div>
              </div>

              <div className="tema-info">
                <div className="tema-nome">
                  <Icon size={15} strokeWidth={1.6} />
                  {o.label}
                  {ativo && <Check size={14} strokeWidth={2.5} className="tema-check" />}
                </div>
                <div className="tema-desc">{o.descricao}</div>
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
