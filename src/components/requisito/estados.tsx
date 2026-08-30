import { Check, Link2Off } from "lucide-react";

// As duas telas que substituem o formulário.
//
// Nenhuma delas explica POR QUE o link não vale. Distinguir "expirado" de
// "inexistente" conta a quem estiver adivinhando qual das duas coisas ele
// acertou — e para quem tem o link certo a distinção não muda nada.

export function LinkRecusado() {
  return (
    <main className="rq-root">
      <div className="rq-fim">
        <span className="rq-fim-marca recusa" aria-hidden="true">
          <Link2Off size={22} strokeWidth={2} />
        </span>
        <h2 className="rq-fim-titulo">Este link não é válido</h2>
        <p className="rq-fim-texto">
          Fale com a clínica pelo WhatsApp para receber um novo.
        </p>
      </div>
    </main>
  );
}

export function JaRespondido() {
  return (
    <main className="rq-root">
      <div className="rq-fim">
        <span className="rq-fim-marca" aria-hidden="true">
          <Check size={22} strokeWidth={2.5} />
        </span>
        <h2 className="rq-fim-titulo">Você já respondeu, obrigado</h2>
        <p className="rq-fim-texto">Não precisa fazer mais nada.</p>
      </div>
    </main>
  );
}
