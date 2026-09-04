import { Clock, Sparkles } from "lucide-react";

// Cartão de memória do cliente — o que a equipe (e a Sofia) enxergam.
// Dados fictícios.
export function MockCliente() {
  return (
    <div className="s-mock w-full max-w-[380px]">
      <div className="s-mock-topo">
        <span className="s-mock-titulo">Cliente</span>
        <span className="s-mock-sub">desde mar 2025</span>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-3">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full font-[family-name:var(--font-cormorant)] text-[17px] text-white"
            style={{ background: "linear-gradient(135deg,#b8955a,#9b7d5a)" }}
            aria-hidden
          >
            AP
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-medium text-s-ink">Ana P.</div>
            <div className="text-[12px] text-s-muted">7 atendimentos</div>
          </div>
          <span className="ml-auto rounded-full bg-[#e8f4ed] px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#3a6b4f]">
            CLIENTE
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-1.5">
          <span className="s-tag">prefere tardes</span>
          <span className="s-tag">interessada em drenagem</span>
        </div>

        <div className="mt-5">
          <div className="s-linha-dado">
            <span className="text-s-muted">Última visita</span>
            <span className="font-medium text-s-ink">04/07 · Drenagem</span>
          </div>
          <div className="s-linha-dado">
            <span className="text-s-muted">Próxima visita</span>
            <span className="font-medium text-s-ink">24/07, 15h</span>
          </div>
          <div className="s-linha-dado">
            <span className="text-s-muted">Ticket médio</span>
            <span className="font-medium text-s-ink">R$ 118</span>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-[#faf8f4] p-3.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.1em] text-s-gold">
            <Sparkles size={11} strokeWidth={2} />
            RESUMO
          </div>
          <p className="text-[12.5px] leading-relaxed text-s-ink2">
            Vem sempre à tarde, costuma remarcar na semana seguinte quando falta.
            Perguntou sobre pacote de 10 sessões em junho.
          </p>
        </div>

        <div className="mt-3.5 flex items-center gap-1.5 text-[11px] text-s-muted">
          <Clock size={11} strokeWidth={1.6} />
          Atualizado a cada conversa
        </div>
      </div>
    </div>
  );
}
