"use client";

import { useEffect, useRef, useState } from "react";
import { BellOff, MoreHorizontal } from "lucide-react";
import { ehAmanha, horaCurta, type CartaoKanban, type ColunaKanban } from "@/lib/kanban";

// Um cartão do quadro, em TRÊS linhas.
//
// A segunda junta o que antes eram duas: `via Fulano` tinha linha própria e
// custava altura em todo cartão de marcação feita por terceiro. Como as três
// informações são o mesmo assunto — para quem, o quê, quando —, elas viram uma
// frase separada por `·`.
//
// ACESSIBILIDADE: arrastar não é o único caminho, é o caminho rápido. Quem usa
// teclado — ou toque, onde o drag-and-drop nativo do HTML5 simplesmente não
// existe — move pelo menu `⋯`. Sem ele a tela seria inoperável para metade dos
// casos, e isso não é detalhe de acabamento.

export function CartaoKanbanCard({
  cartao,
  colunas,
  statusAtual,
  onMover,
  arrastando,
  onArrastar,
}: {
  cartao: CartaoKanban;
  colunas: ColunaKanban[];
  statusAtual: string;
  onMover: (destino: string) => void;
  arrastando: boolean;
  onArrastar: (id: string | null) => void;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  // O corpo da coluna rola (`overflow-y`), então um menu `absolute` seria
  // cortado na borda. `fixed` ancorado ao retângulo do botão escapa disso sem
  // precisar de portal.
  const [ancora, setAncora] = useState<{ x: number; y: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAberto) return;
    const fora = (e: MouseEvent) => {
      if (
        !menu.current?.contains(e.target as Node) &&
        !botao.current?.contains(e.target as Node)
      ) {
        setMenuAberto(false);
      }
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuAberto(false);
        botao.current?.focus();
      }
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    // O menu é `fixed` e ancorado no retângulo do botão: se a coluna rolar
    // debaixo dele, a âncora envelhece. Fechar é mais honesto que segui-lo.
    const rolou = () => setMenuAberto(false);
    window.addEventListener("scroll", rolou, true);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", rolou, true);
    };
  }, [menuAberto]);

  function abrir() {
    const r = botao.current?.getBoundingClientRect();
    if (r) setAncora({ x: r.right, y: r.bottom + 4 });
    setMenuAberto(true);
  }

  const semLembrete = !cartao.lembrete_enviado && ehAmanha(cartao.quando);
  const destinos = colunas.filter((c) => c.status !== statusAtual);

  // `via Fulano` só entra quando alguém marcou para outra pessoa.
  const meta = [
    cartao.titular ? `via ${cartao.titular}` : null,
    cartao.servico || "Sem procedimento",
    horaCurta(cartao.quando),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={`kb-cartao${cartao.atrasado ? " atrasado" : ""}${
        arrastando ? " arrastando" : ""
      }`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", cartao.agendamento_id);
        onArrastar(cartao.agendamento_id);
      }}
      onDragEnd={() => onArrastar(null)}
    >
      <div className="kb-cartao-topo">
        <span className="kb-cartao-quem">{cartao.quem}</span>
        <button
          type="button"
          ref={botao}
          onClick={() => (menuAberto ? setMenuAberto(false) : abrir())}
          aria-haspopup="menu"
          aria-expanded={menuAberto}
          aria-label={`Mover ${cartao.quem} para outra coluna`}
          className="kb-cartao-menu"
        >
          <MoreHorizontal size={14} strokeWidth={2} />
        </button>
      </div>

      <p className="kb-cartao-meta">
        {meta}
        {semLembrete && (
          <span
            className="kb-cartao-sino"
            title="É amanhã e o lembrete ainda não saiu"
            aria-label="É amanhã e o lembrete ainda não saiu"
          >
            <BellOff size={11} strokeWidth={1.8} />
          </span>
        )}
      </p>

      {cartao.profissional && (
        <p className="kb-cartao-prof">{cartao.profissional}</p>
      )}

      {menuAberto && ancora && (
        <div
          ref={menu}
          role="menu"
          aria-label="Mover para"
          className="kb-menu"
          style={{ left: ancora.x, top: ancora.y }}
        >
          <p className="kb-menu-titulo">Mover para</p>
          {destinos.map((c) => (
            <button
              key={c.status}
              type="button"
              role="menuitem"
              className="kb-menu-item"
              onClick={() => {
                setMenuAberto(false);
                onMover(c.status);
              }}
            >
              <span
                className="kb-menu-ponto"
                style={{ background: `var(${c.token})` }}
                aria-hidden="true"
              />
              {c.rotulo}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
