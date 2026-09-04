"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/modal";
import { showToast } from "@/lib/toast";
import { removerBloqueio, rotuloBloqueio, type Bloqueio } from "@/lib/bloqueios";

// Detalhe do bloqueio. Sem tela de edição de propósito: remover e refazer é
// mais curto que um formulário, e evita ter que decidir o que fazer quando o
// "Todas" foi gravado como quatro linhas e a pessoa edita uma só.

function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function hhmm(t: string): string {
  return t.slice(0, 5);
}

export function BloqueioPopover({
  bloqueio,
  nomeProfissional,
  onClose,
  onRemovido,
}: {
  bloqueio: Bloqueio;
  nomeProfissional: string;
  onClose: () => void;
  onRemovido: () => void;
}) {
  const [removendo, setRemovendo] = useState(false);

  const quando =
    bloqueio.hora_inicio && bloqueio.hora_fim
      ? `${dataBR(bloqueio.data)}, ${hhmm(bloqueio.hora_inicio)} às ${hhmm(bloqueio.hora_fim)}`
      : `${dataBR(bloqueio.data)}, dia inteiro`;

  async function remover() {
    setRemovendo(true);
    try {
      await removerBloqueio(bloqueio.id);
      showToast("Bloqueio removido", "success");
      onRemovido();
      onClose();
    } catch {
      showToast("Não deu para remover o bloqueio", "error");
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <Modal open onClose={onClose} width={320}>
      <div className="blq-titulo">{rotuloBloqueio(bloqueio)}</div>
      <dl className="blq-detalhe">
        <dt>Quem</dt>
        <dd>{nomeProfissional}</dd>
        <dt>Quando</dt>
        <dd>{quando}</dd>
        {bloqueio.motivo?.trim() && (
          <>
            <dt>Motivo</dt>
            <dd>{bloqueio.motivo}</dd>
          </>
        )}
      </dl>
      <p className="blq-nota">
        Enquanto existir, este horário não aparece para a agente nem conta na
        capacidade da agenda.
      </p>
      <div className="blq-acoes">
        <button
          type="button"
          className="btn-ghost blq-remover"
          disabled={removendo}
          onClick={remover}
        >
          <Trash2 size={13} strokeWidth={1.9} />
          {removendo ? "Removendo…" : "Remover bloqueio"}
        </button>
      </div>
    </Modal>
  );
}
