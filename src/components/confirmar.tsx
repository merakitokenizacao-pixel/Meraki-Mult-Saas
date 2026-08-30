"use client";

import { Modal } from "@/components/modal";

// A confirmação de uma ação irreversível.
//
// ⚠️ NOMEIA O ITEM, sempre: "Excluir a profissional Rozaria?", nunca "Tem
// certeza?". Diálogo genérico é clicado no automático — a pessoa aprende a
// forma do botão e para de ler o texto. O nome no título é o que faz o olho
// parar e conferir se é aquilo mesmo.
//
// ⚠️ E NÃO É `window.confirm`. O diálogo nativo é desenhado pelo sistema
// operacional, que é CLARO: no painel escuro ele aparece como uma caixa branca
// no meio da tela, sem nenhuma relação com o resto. É o mesmo motivo pelo qual
// `<select>` saiu da Visão geral.
//
// A ação destrutiva usa `--mk-st-erro` SÓ NO TEXTO. Botão vermelho sólido puxa
// o clique justamente no lugar onde não se quer pressa.

export function Confirmar({
  aberto,
  titulo,
  texto,
  rotuloAcao = "Excluir",
  onConfirmar,
  onCancelar,
}: {
  aberto: boolean;
  /** Nomeia o item: "Excluir a profissional Rozaria?" */
  titulo: string;
  /** O que acontece de verdade, incluindo o que não dá para desfazer. */
  texto: string;
  rotuloAcao?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <Modal open={aberto} onClose={onCancelar} width={420}>
      <h2 className="cfm-titulo">{titulo}</h2>
      <p className="cfm-texto">{texto}</p>
      <div className="cfm-acoes">
        <button type="button" className="btn-ghost" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="cfm-destrutivo" onClick={onConfirmar}>
          {rotuloAcao}
        </button>
      </div>
    </Modal>
  );
}
