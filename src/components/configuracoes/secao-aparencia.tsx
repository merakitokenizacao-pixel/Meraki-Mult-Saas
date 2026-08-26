"use client";

import { Check, Contrast } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { TEMAS, type Tema } from "@/lib/tema";

// As opções vêm do catálogo (lib/tema.ts) — sistema novo lá aparece aqui
// sozinho. Só o ícone mora nesta camada, que é a única que desenha.
//
// Hoje o catálogo tem UMA entrada: o sistema Meraki não tem versão clara
// (superfície é branco a 3% SOBRE preto; sobre branco isso não é nada). O
// cartão então mostra a aparência EM USO em vez de oferecer uma escolha que
// não existe — ver a nota no rodapé.
const ICONES: Record<Tema, LucideIcon> = {
  meraki: Contrast,
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
        O painel tem <strong>um</strong> sistema visual. Ele nasce escuro por
        construção: a superfície é branco a 3% sobre preto, e sobre um fundo
        claro isso deixa de ser superfície. A ficha que a cliente recebe pelo
        WhatsApp segue caminho próprio — é sempre clara, com a identidade da
        clínica.
      </p>
    </div>
  );
}
