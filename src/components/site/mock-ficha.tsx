import { TriangleAlert } from "lucide-react";

// Ficha de avaliação do laser vista pela equipe. O banner vermelho é o ponto:
// a contraindicação aparece SEM precisar abrir nada. Dados fictícios.
const RESPOSTAS: [string, string][] = [
  ["Está gestante?", "Sim"],
  ["Se bronzeou recentemente?", "Sim — 5 dias"],
  ["Faz uso de algum medicamento?", "Não"],
  ["Tem tatuagem na área?", "Não"],
];

export function MockFicha() {
  return (
    <div className="s-mock w-full max-w-[380px]">
      <div className="s-mock-topo">
        <span className="s-mock-titulo">Ficha do laser</span>
        <span className="s-mock-sub">preenchida 18/07</span>
      </div>

      {/* Visível sem clique — é o requisito de segurança */}
      <div className="s-alerta">
        <TriangleAlert size={15} strokeWidth={2} />
        CONTRAINDICAÇÃO · GESTANTE
      </div>

      <div className="p-5">
        <div className="mb-4 flex flex-wrap gap-1.5">
          <span className="s-chip-atencao">Bronzeamento há menos de 15 dias</span>
        </div>

        {RESPOSTAS.map(([p, r]) => (
          <div key={p} className="s-linha-dado">
            <span className="text-s-muted">{p}</span>
            <span
              className={`shrink-0 font-medium ${
                r.startsWith("Sim") ? "text-[#a3342a]" : "text-s-ink"
              }`}
            >
              {r}
            </span>
          </div>
        ))}

        <p className="mt-5 text-[11.5px] leading-relaxed text-s-muted">
          A cliente preencheu pelo celular, por um link de uso único enviado no
          WhatsApp.
        </p>
      </div>
    </div>
  );
}
