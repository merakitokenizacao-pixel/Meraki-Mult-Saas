"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DateRangePicker } from "@/components/date-range-picker";
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
// apagaria a taxa de no-show, que é o número do cabeçalho.

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

  return (
    <div className="page-fade kb-tela">
      <div className="kb-topo">
        <div>
          <h1 className="kb-titulo">Kanban</h1>
          <p className="kb-sub">{rotuloIntervalo(period)}</p>
        </div>
        <div className="kb-topo-acoes">
          {taxa && (
            // O número que a dona não tem de nenhuma outra fonte. Faltas sobre
            // quem DEVERIA comparecer (realizados + faltas) — cancelamento não
            // entra no denominador, senão avisar antes pioraria a taxa.
            <p className="kb-taxa">
              <span className="kb-taxa-rotulo">Faltou</span>
              <span className="kb-taxa-valor">
                {taxa.faltas} de {taxa.realizados + taxa.faltas}
              </span>
              {taxa.taxa_falta != null && (
                <span className="kb-taxa-pct">
                  {String(taxa.taxa_falta).replace(".", ",")}%
                </span>
              )}
            </p>
          )}
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
        <div className="kb-quadro">
          {colunas.map((c) => (
            <section
              key={c.status}
              className={`kb-coluna${alvo === c.status ? " alvo" : ""}`}
              style={{ ["--kb-cor" as string]: `var(${c.token})` }}
              onDragOver={(e) => {
                // Sem o preventDefault o navegador recusa o drop — é a parte
                // menos óbvia da API nativa.
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
              <header className="kb-coluna-topo">
                <div className="kb-coluna-linha">
                  <h2 className="kb-coluna-titulo">{c.rotulo}</h2>
                  <span className="kb-coluna-contagem">{c.cartoes.length}</span>
                </div>
                {c.descricao && (
                  <p className="kb-coluna-desc">{c.descricao}</p>
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
                      onMover={(destino) => mover(cartao.agendamento_id, destino)}
                    />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
