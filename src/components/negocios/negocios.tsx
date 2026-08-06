"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  Clock3,
  Percent,
  Plus,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";
import {
  useAgendamentosDeFollowUp,
  useAtendimentosDoPeriodo,
  useCriadosNoPeriodo,
  useFinanceiroResumo,
  usePacotesSaldo,
  usePagamentosDoPeriodo,
  useTemProfissional,
} from "@/lib/hooks";
import {
  agruparPorValor,
  intervaloDoPeriodo,
  moeda,
  nomeDoAtendimento,
  num,
} from "@/lib/financeiro";
import { KpiCard } from "@/components/negocios/kpi-card";
import { RankingValor } from "@/components/negocios/ranking-valor";
import { FormasPagamento } from "@/components/negocios/formas-pagamento";
import { PacotesSaldo } from "@/components/negocios/pacotes-saldo";
import { AtendimentosLista } from "@/components/negocios/atendimentos-lista";

// Aba financeira, ligada na fonte real (estrutura de ago/2026).
//
// A RÉGUA que a tela não pode confundir, e por isso os blocos são separados:
//   Bloco 1 CAIXA     → dinheiro que entrou (pagamentos)
//   Bloco 2 PIPELINE  → o que está marcado e ainda pode virar dinheiro
//   Bloco 3 COMPOSIÇÃO→ de onde vem, e o passivo já vendido a entregar
// Os três nunca batem, e está certo que não batam.

export function Negocios({ period }: { period: string }) {
  const intervalo = useMemo(() => intervaloDoPeriodo(period), [period]);

  const resumoQ = useFinanceiroResumo(intervalo);
  const pagamentosQ = usePagamentosDoPeriodo(intervalo);
  const periodoQ = useAtendimentosDoPeriodo(intervalo);
  const pacotesQ = usePacotesSaldo();
  const temProfQ = useTemProfissional();
  const criadosQ = useCriadosNoPeriodo(intervalo);
  const deFollowUpQ = useAgendamentosDeFollowUp();

  const r = resumoQ.data;
  const carregando = resumoQ.isPending;
  const atendimentos = useMemo(() => periodoQ.data ?? [], [periodoQ.data]);

  const [verFilaConferencia, setVerFilaConferencia] = useState(false);

  // Conversão agendado→realizado: só entre os que JÁ resolveram. Pendente e
  // confirmado ainda não viraram nem uma coisa nem outra, então incluí-los no
  // denominador faria a taxa despencar só porque a agenda está cheia à frente.
  const conversao = useMemo(() => {
    const feitos = atendimentos.filter((a) => a.status === "realizado").length;
    const perdidos = atendimentos.filter((a) => a.status === "cancelado").length;
    const resolvidos = feitos + perdidos;
    return { pct: resolvidos > 0 ? (feitos / resolvidos) * 100 : null, feitos, perdidos };
  }, [atendimentos]);

  // Receita recuperada: atendimento realizado que NASCEU de um follow-up.
  // O cruzamento é feito aqui porque os atendimentos do período já estão
  // carregados — evita um join e não busca a mesma coisa duas vezes.
  const recuperado = useMemo(() => {
    const ids = deFollowUpQ.data;
    if (!ids || periodoQ.isPending) return null;
    let valor = 0;
    let qtd = 0;
    for (const a of atendimentos) {
      if (a.status !== "realizado" || !ids.has(a.id)) continue;
      valor += num(a.valor);
      qtd += 1;
    }
    return { valor, qtd };
  }, [deFollowUpQ.data, atendimentos, periodoQ.isPending]);

  // Composições: só realizados, e sobre o conjunto INTEIRO do período (a busca
  // é paginada até a página curta) — se cortasse, as somas mentiriam.
  const realizados = useMemo(
    () => atendimentos.filter((a) => a.status === "realizado"),
    [atendimentos]
  );
  const porProcedimento = useMemo(
    () =>
      agruparPorValor(
        realizados,
        (a) => nomeDoAtendimento(a.procedimento, a.servico_texto),
        (a) => num(a.valor)
      ),
    [realizados]
  );
  const porCategoria = useMemo(
    () => agruparPorValor(realizados, (a) => a.categoria, (a) => num(a.valor), 6),
    [realizados]
  );
  const porProfissional = useMemo(
    () => agruparPorValor(realizados, (a) => a.profissional, (a) => num(a.valor), 6),
    [realizados]
  );

  // Campos de dinheiro do resumo — todos chegam como string (numeric do
  // Postgres via PostgREST), por isso passam por `num()`.
  type CampoMoeda =
    | "recebido"
    | "a_receber"
    | "previsto"
    | "faturado"
    | "perdido"
    | "ticket_medio";
  const v = (campo: CampoMoeda) =>
    carregando || !r ? "—" : moeda(num(r[campo]));

  return (
    <div className="neg-fill">
      {/* O banner de "valores estimados" morreu com a estimativa. No lugar,
          só aparece o que ainda falta resolver no dado. */}
      {!carregando && r && r.sem_procedimento > 0 && (
        <button
          type="button"
          className="neg-aviso neg-aviso-btn"
          onClick={() => setVerFilaConferencia(true)}
        >
          <TriangleAlert size={15} strokeWidth={1.8} />
          <div>
            <strong>{r.sem_procedimento} atendimentos sem procedimento.</strong>{" "}
            Ficaram sem vínculo com o catálogo, então entram com valor nulo — o{" "}
            <em>faturado</em> abaixo é piso, não total. Clique para abrir a fila
            de conferência.
          </div>
        </button>
      )}

      {/* ── OS 5 CARDS ──────────────────────────────────────────────────────
          Mesma fileira de antes; o que mudou é a FONTE: nada mais é estimado.
          Cada um puxa da coluna que responde a pergunta dele. */}
      <div className="neg-grid">
        <KpiCard
          rotulo="Total criado"
          valor={
            criadosQ.isPending ? "—" : moeda(criadosQ.data?.valor ?? 0)
          }
          apoio={
            criadosQ.isPending
              ? " "
              : `${criadosQ.data?.qtd ?? 0} agendamentos marcados`
          }
          icone={Plus}
          tom="blue"
          dica="O que entrou no funil no período, pela data em que foi MARCADO — um agendamento feito hoje para setembro conta hoje."
        />
        <KpiCard
          rotulo="Total ganhos"
          valor={v("faturado")}
          apoio={
            carregando || !r ? " " : `${r.atendimentos_realizados} realizados`
          }
          icone={TrendingUp}
          tom="green"
          dica="Valor dos atendimentos realizados no período. Serviço entregue — não é o mesmo que dinheiro recebido."
        />
        <KpiCard
          rotulo="Total perdidos"
          valor={v("perdido")}
          apoio={periodoQ.isPending ? " " : `${conversao.perdidos} cancelados`}
          icone={TrendingDown}
          tom="red"
          dica="Valor dos cancelados que teriam acontecido no período."
        />
        <KpiCard
          rotulo="Total em aberto"
          valor={v("previsto")}
          apoio="pendentes e confirmados"
          icone={CalendarClock}
          tom="accent"
          selo="de agora em diante"
          dica="Agendamento futuro pendente ou confirmado. NÃO segue o filtro de período: pipeline é sempre daqui pra frente. Pendente e confirmado andam juntos porque 'confirmado' só quer dizer que o lembrete rodou e ninguém desmarcou."
        />
        <KpiCard
          rotulo="Receita recuperada"
          valor={recuperado == null ? "—" : moeda(recuperado.valor)}
          apoio={
            recuperado == null
              ? " "
              : `${recuperado.qtd} voltaram pelo follow-up`
          }
          icone={RotateCcw}
          tom="purple"
          dica="Atendimentos realizados que nasceram de um follow-up (follow_ups.agendamento_id). Hoje nenhum follow-up virou agendamento ainda, então o zero é real."
        />
      </div>

      {/* ── CAIXA ───────────────────────────────────────────────────────── */}
      <h2 className="neg-bloco-titulo">Caixa</h2>
      <div className="neg-secao-2">
        <div className="neg-grid neg-grid-3">
          <KpiCard
            rotulo="Recebido"
            valor={v("recebido")}
            apoio="pagamentos no período"
            icone={Wallet}
            tom="green"
            dica="Soma de pagamentos.valor no período. É o único número que representa dinheiro que entrou de fato."
          />
          <KpiCard
            rotulo="A receber"
            valor={v("a_receber")}
            apoio="realizado com saldo aberto"
            icone={Clock3}
            tom="accent"
            dica="Atendimento entregue no período que ainda tem saldo em aberto."
          />
          <KpiCard
            rotulo="Ticket médio"
            valor={v("ticket_medio")}
            apoio={
              carregando || !r
                ? " "
                : `${r.atendimentos_realizados} realizados`
            }
            icone={Percent}
            tom="blue"
            dica="Média do valor dos realizados com valor maior que zero."
          />
        </div>

        <section className="neg-painel">
          <header className="neg-painel-topo">
            <div>
              <h3 className="neg-painel-titulo">Como entrou</h3>
              <span className="neg-painel-nota">
                Taxa de maquininha come margem e pix não
              </span>
            </div>
          </header>
          {pagamentosQ.isPending ? (
            <div className="neg-vazio">Carregando…</div>
          ) : (
            <FormasPagamento pagamentos={pagamentosQ.data ?? []} />
          )}
        </section>
      </div>

      {/* ── COMPOSIÇÃO ──────────────────────────────────────────────────── */}
      <h2 className="neg-bloco-titulo">Composição</h2>
      <div className="neg-secao-2 par">
        <section className="neg-painel">
          <header className="neg-painel-topo">
            <div>
              <h3 className="neg-painel-titulo">Por procedimento</h3>
              <span className="neg-painel-nota">Realizados no período</span>
            </div>
          </header>
          {periodoQ.isPending ? (
            <div className="neg-vazio">Carregando…</div>
          ) : (
            <RankingValor linhas={porProcedimento} />
          )}
        </section>

        <section className="neg-painel">
          <header className="neg-painel-topo">
            <div>
              <h3 className="neg-painel-titulo">Por categoria</h3>
              <span className="neg-painel-nota">Realizados no período</span>
            </div>
          </header>
          {periodoQ.isPending ? (
            <div className="neg-vazio">Carregando…</div>
          ) : (
            <RankingValor linhas={porCategoria} />
          )}
        </section>
      </div>

      <div className="neg-secao-2 par">
        <section className="neg-painel">
          <header className="neg-painel-topo">
            <div>
              <h3 className="neg-painel-titulo">Pacotes a entregar</h3>
              <span className="neg-painel-nota">
                Receita já reconhecida na venda
              </span>
            </div>
          </header>
          {pacotesQ.isPending ? (
            <div className="neg-vazio">Carregando…</div>
          ) : (
            <PacotesSaldo pacotes={pacotesQ.data ?? []} />
          )}
        </section>

        {/* Condição no DADO: o card volta sozinho quando a Agenda começar a
            atribuir. Enquanto profissional_id for nulo em tudo, um donut vazio
            ou zerado seria pior que a ausência. */}
        {temProfQ.data ? (
          <section className="neg-painel">
            <header className="neg-painel-topo">
              <div>
                <h3 className="neg-painel-titulo">Por profissional</h3>
                <span className="neg-painel-nota">Realizados no período</span>
              </div>
            </header>
            <RankingValor linhas={porProfissional} />
          </section>
        ) : (
          <section className="neg-painel neg-painel-aguardando">
            <Users size={18} strokeWidth={1.6} />
            <div>
              <strong>Divisão por profissional</strong>
              <p>
                Aparece aqui assim que os atendimentos passarem a ser atribuídos
                na Agenda. Hoje nenhum tem profissional definido.
              </p>
            </div>
          </section>
        )}
      </div>

      {/* ── Lista de atendimentos ───────────────────────────────────────── */}
      <section className="neg-painel neg-painel-lista">
        <header className="neg-painel-topo">
          <div>
            <h3 className="neg-painel-titulo">Atendimentos</h3>
            <span className="neg-painel-nota">
              Registre pagamento na linha. Estorno entra como tipo
              &ldquo;estorno&rdquo; e faz o saldo voltar a subir.
            </span>
          </div>
        </header>
        <AtendimentosLista
          intervalo={intervalo}
          soSemProcedimentoInicial={verFilaConferencia}
          key={verFilaConferencia ? "fila" : "tudo"}
        />
      </section>
    </div>
  );
}
