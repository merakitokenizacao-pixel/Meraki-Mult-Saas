"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DateRangePicker } from "@/components/date-range-picker";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { CartaoKanbanCard } from "@/components/kanban/cartao-kanban";
import { getDateRange, rotuloIntervalo } from "@/lib/date";
import { useKanban } from "@/lib/hooks";
import { fetchPainel } from "@/lib/api-painel";
import { comoData, type PainelKanban } from "@/lib/kanban";
import { showToast } from "@/lib/toast";

// Kanban da agenda.
//
// As cinco colunas vêm de `kanban_colunas` — rótulo, descrição, cor e ordem.
// NENHUM rótulo escrito aqui: outra clínica terá outros, e a tabela é por
// tenant. O componente só sabe desenhar o que o banco mandou.
//
// ⚠️ Faltou e Cancelado são colunas DIFERENTES. Quem avisa dá chance de
// revender o horário; quem não aparece leva a receita junto. Juntar as duas
// apagaria a taxa de no-show — que mora DENTRO da coluna Faltou, e não solta
// no topo ao lado do seletor de data, onde estava sem contexto nenhum.

// Janelas para FRENTE. O quadro é fila de trabalho: o que interessa é o que
// ainda vem, não o que já passou. (O calendário do próprio seletor continua
// disponível para um intervalo à mão.)
const ATALHOS: ReadonlyArray<readonly [string, string]> = [
  ["hoje", "Hoje"],
  ["prox7", "Próximos 7 dias"],
  ["prox15", "Próximos 15 dias"],
  ["prox30", "Próximos 30 dias"],
  ["mes", "Este mês"],
  ["7d", "Últimos 7 dias"],
  ["30d", "Últimos 30 dias"],
];

export function Kanban() {
  const qc = useQueryClient();
  // Sem filtro, `kanban()` traz tudo e o quadro fica impraticável com dado
  // real. O padrão é a janela que responde "o que tenho pela frente".
  const [period, setPeriod] = useState("prox7");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);

  const [de, ate] = useMemo(() => {
    const r = getDateRange(period);
    if (!r) return [null, null] as [string | null, string | null];
    // `to` é exclusivo no resto do projeto; as funções do banco recebem `date`
    // e comparam com `< p_ate + 1`, então o último dia é o dia anterior a `to`.
    return [comoData(r.from), comoData(new Date(r.to.getTime() - 86400000))];
  }, [period]);

  const chave = ["kanban", de, ate];
  const { data, isPending, isError } = useKanban(de, ate);
  const colunas = data?.colunas ?? [];
  const taxa = data?.taxa;

  /**
   * Move otimista: o cartão troca de coluna na hora e a rede corre atrás.
   *
   * Se a resposta falhar — rede, `NAO_ENCONTRADO`, `STATUS_INVALIDO` — o
   * quadro volta EXATAMENTE ao que era antes do arrasto, com o cartão na
   * coluna de origem. Guardar o snapshot inteiro é o que garante isso: repor
   * "de volta ao status anterior" à mão erraria a posição dentro da coluna,
   * que é ordenada por horário.
   */
  async function mover(agendamento_id: string, destino: string) {
    const antes = qc.getQueryData<PainelKanban>(chave);
    if (!antes) return;

    let cartao = null as (typeof antes.colunas)[number]["cartoes"][number] | null;
    for (const c of antes.colunas) {
      const achado = c.cartoes.find((x) => x.agendamento_id === agendamento_id);
      if (achado) cartao = achado;
    }
    if (!cartao) return;
    const movido = cartao;

    qc.setQueryData<PainelKanban>(chave, {
      ...antes,
      colunas: antes.colunas.map((c) => {
        if (c.status === destino) {
          return {
            ...c,
            cartoes: [...c.cartoes, movido].sort(
              (a, b) => +new Date(a.quando) - +new Date(b.quando)
            ),
          };
        }
        return {
          ...c,
          cartoes: c.cartoes.filter((x) => x.agendamento_id !== agendamento_id),
        };
      }),
    });

    try {
      const r = await fetchPainel("/api/painel/kanban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agendamento_id, status: destino }),
      });
      const j = (await r.json()) as { ok?: boolean; codigo?: string; motivo?: string };

      if (!r.ok || j.ok === false) {
        qc.setQueryData(chave, antes);
        showToast(j.motivo || "Não foi possível mover o cartão", "error");
        return;
      }
      // Aviso, não bloqueio: a função move e devolve o alerta. Marcar como
      // realizado antes da hora costuma ser engano, mas a dona conhece o caso
      // melhor que qualquer matriz de transição — kanban rígido é como se
      // volta a anotar no caderno.
      if (j.codigo === "REALIZADO_ANTES_DA_HORA") {
        showToast(j.motivo || "Movido, mas o horário ainda não chegou", "info");
      }
      // `SEM_MUDANCA` não pede nada: o cartão já estava lá.
      qc.invalidateQueries({ queryKey: ["kanban"] });
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
    } catch {
      qc.setQueryData(chave, antes);
      showToast("Sem conexão — o cartão voltou para a coluna de origem", "error");
    }
  }

  // ── Rolagem lateral ───────────────────────────────────────────────────────
  // 240px por coluna é escolha deliberada: cinco cabem em ~1300px, então rolar
  // de lado vira exceção. Quando vira necessário, o que comunica é o corte na
  // borda (a última coluna aparece pela metade), o esmaecimento e as setas —
  // nunca um controle que só existe no hover.
  const quadro = useRef<HTMLDivElement>(null);
  const [podeEsq, setPodeEsq] = useState(false);
  const [podeDir, setPodeDir] = useState(false);

  const atualizarBordas = useCallback(() => {
    const el = quadro.current;
    if (!el) return;
    // 1px de folga: `scrollLeft` fracionário em tela com zoom deixaria a seta
    // acesa para sempre no fim da rolagem.
    setPodeEsq(el.scrollLeft > 1);
    setPodeDir(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = quadro.current;
    if (!el) return;
    atualizarBordas();
    // Redimensionar a janela muda o que cabe, e nenhum evento de scroll
    // dispara nesse caso.
    const ro = new ResizeObserver(atualizarBordas);
    ro.observe(el);
    return () => ro.disconnect();
  }, [atualizarBordas, colunas.length]);

  function deslizar(dir: 1 | -1) {
    // Uma coluna + o gap por clique — a mesma unidade do scroll-snap.
    quadro.current?.scrollBy({ left: dir * 250, behavior: "smooth" });
  }

  // Shift + roda: no mouse comum não existe eixo X, e sem isto o quadro só
  // rolaria com a barra ou com trackpad.
  //
  // ⚠️ LISTENER NATIVO, e não `onWheel`. O React registra `wheel` como PASSIVO,
  // e num listener passivo o `preventDefault()` é ignorado (com aviso no
  // console) — o resultado seria o quadro rolar de lado E a página tentar
  // rolar junto. `{ passive: false }` é o que devolve o direito de cancelar.
  useEffect(() => {
    const el = quadro.current;
    if (!el) return;
    const aoRolar = (e: WheelEvent) => {
      if (!e.shiftKey || e.deltaY === 0) return;
      if (el.scrollWidth <= el.clientWidth) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener("wheel", aoRolar, { passive: false });
    return () => el.removeEventListener("wheel", aoRolar);
  }, []);

  // ⚠️ AUTO-SCROLL AO ARRASTAR NÃO É CONFORTO. Se a pessoa arrasta de Pendente
  // para Cancelado e a coluna de destino está fora da tela, sem isto ela não
  // consegue soltar em lugar nenhum — o cartão fica preso.
  //
  // O laço vive num rAF enquanto o ponteiro está perto da borda; `dragover`
  // dispara com frequência irregular e rolar dentro dele daria solavanco.
  const bordaAtiva = useRef(0);
  const laco = useRef<number | null>(null);

  const pararLaco = useCallback(() => {
    if (laco.current != null) cancelAnimationFrame(laco.current);
    laco.current = null;
    bordaAtiva.current = 0;
  }, []);

  const rodarLaco = useCallback(() => {
    const el = quadro.current;
    if (el && bordaAtiva.current !== 0) el.scrollLeft += bordaAtiva.current * 14;
    laco.current = requestAnimationFrame(rodarLaco);
  }, []);

  function aoArrastarSobreOQuadro(e: React.DragEvent) {
    const el = quadro.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ZONA = 72;
    bordaAtiva.current =
      e.clientX < r.left + ZONA ? -1 : e.clientX > r.right - ZONA ? 1 : 0;
    if (laco.current == null) laco.current = requestAnimationFrame(rodarLaco);
  }

  // Solta o laço quando o arrasto acaba de qualquer jeito — inclusive com Esc
  // ou soltando fora do quadro, que não disparam `drop`.
  useEffect(() => {
    if (!arrastando) {
      pararLaco();
      return;
    }
    window.addEventListener("dragend", pararLaco);
    window.addEventListener("drop", pararLaco);
    return () => {
      window.removeEventListener("dragend", pararLaco);
      window.removeEventListener("drop", pararLaco);
      pararLaco();
    };
  }, [arrastando, pararLaco]);

  // Base do no-show: quem DEVERIA ter comparecido. Cancelamento fica fora do
  // denominador — senão avisar antes pioraria a taxa de quem avisou.
  const baseNoShow = taxa ? taxa.realizados + taxa.faltas : 0;

  return (
    <div className="page-fade kb-tela">
      {/* Um título só na tela: a barra de topo some em /kanban (ver
          app-shell.tsx), e o período sobe para a linha do H1 em vez de ocupar
          linha própria. */}
      <div className="kb-topo">
        <h1 className="kb-titulo">Kanban</h1>
        <span className="kb-sub">{rotuloIntervalo(period)}</span>
        <div className="kb-topo-acoes">
          <DateRangePicker value={period} onChange={setPeriod} atalhos={ATALHOS} />
        </div>
      </div>

      {isError ? (
        <p className="kb-vazio">Não foi possível carregar o quadro.</p>
      ) : isPending ? (
        <p className="kb-vazio">Carregando…</p>
      ) : colunas.length === 0 ? (
        <p className="kb-vazio">
          Esta clínica ainda não tem colunas configuradas no quadro.
        </p>
      ) : (
        <div className={`kb-palco${arrastando ? " arrastando" : ""}`}>
          {/* Setas SEMPRE visíveis, não no hover: seta que só aparece quando o
              mouse chega perto é invisível para quem não passa por ali, e essa
              pessoa nunca descobre que existe mais coluna. Cada uma some
              quando não há mais para onde ir daquele lado. */}
          {podeEsq && (
            <button
              type="button"
              className="kb-seta esq"
              aria-label="Ver colunas à esquerda"
              onClick={() => deslizar(-1)}
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
          )}
          {podeDir && (
            <button
              type="button"
              className="kb-seta dir"
              aria-label="Ver colunas à direita"
              onClick={() => deslizar(1)}
            >
              <ChevronRight size={16} strokeWidth={2} />
            </button>
          )}
          {/* Esmaecimento: diz "continua" sem ocupar espaço nem pedir hover. */}
          {podeEsq && <span className="kb-fade esq" aria-hidden="true" />}
          {podeDir && <span className="kb-fade dir" aria-hidden="true" />}

          <div
            className="kb-quadro"
            ref={quadro}
            onScroll={atualizarBordas}
            onDragOver={aoArrastarSobreOQuadro}
          >
            {colunas.map((c) => {
              // A taxa mora na coluna a que ela se refere. `faltou` é a CHAVE
              // do status no banco, não um rótulo — o rótulo continua vindo de
              // `kanban_colunas`.
              const comTaxa = c.status === "faltou" && taxa != null;
              return (
                <section
                  key={c.status}
                  className={`kb-coluna${alvo === c.status ? " alvo" : ""}`}
                  style={{ ["--kb-cor" as string]: `var(${c.token})` }}
                  onDragOver={(e) => {
                    // Sem o preventDefault o navegador recusa o drop — é a
                    // parte menos óbvia da API nativa.
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (alvo !== c.status) setAlvo(c.status);
                  }}
                  onDragLeave={() => setAlvo((a) => (a === c.status ? null : a))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setAlvo(null);
                    setArrastando(null);
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) mover(id, c.status);
                  }}
                >
                  <header
                    className={`kb-coluna-topo${comTaxa ? " com-taxa" : ""}`}
                  >
                    <div className="kb-coluna-linha">
                      <h2 className="kb-coluna-titulo">{c.rotulo}</h2>
                      <span className="kb-coluna-contagem">
                        {c.cartoes.length}
                      </span>
                      {/* A descrição vira `title`. Ela ensina o significado
                          UMA vez; em texto corrido custava uma linha em cada
                          uma das cinco colunas, para sempre. */}
                      {c.descricao && (
                        <span
                          className="kb-coluna-info"
                          title={c.descricao}
                          aria-label={c.descricao}
                        >
                          <Info size={12} strokeWidth={1.8} />
                        </span>
                      )}
                    </div>
                    {comTaxa && taxa && (
                      <p className="kb-coluna-taxa">
                        {taxa.taxa_falta != null
                          ? `${String(taxa.taxa_falta).replace(".", ",")}% de ${baseNoShow}`
                          : `de ${baseNoShow}`}
                      </p>
                    )}
                  </header>
                  <div className="kb-coluna-corpo">
                    {c.cartoes.length === 0 ? (
                      <p className="kb-coluna-vazia">Nenhum</p>
                    ) : (
                      c.cartoes.map((cartao) => (
                        <CartaoKanbanCard
                          key={cartao.agendamento_id}
                          cartao={cartao}
                          colunas={colunas}
                          statusAtual={c.status}
                          arrastando={arrastando === cartao.agendamento_id}
                          onArrastar={setArrastando}
                          onMover={(destino) =>
                            mover(cartao.agendamento_id, destino)
                          }
                        />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
