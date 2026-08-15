"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Plus,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  useAgendamentosComLead,
  useCatalogoServicos,
  useEscala,
  useFollowUps,
} from "@/lib/hooks";
import { atribuirPorEscala } from "@/lib/atribuicao";
import {
  moeda,
  rankingServicos,
  resumoFinanceiro,
  serieDiaria,
  contarSemPreco,
  valorDe,
} from "@/lib/financeiro";
import { filterByDate } from "@/lib/date";
import { KpiCard, type TomKpi } from "@/components/negocios/kpi-card";
import { Segmentado, VALOR_QTD } from "@/components/segmentado";
import {
  DadosDiarios,
  LegendaSeries,
  type Modo,
  type SerieId,
} from "@/components/negocios/dados-diarios";
import { PercentualProfissional } from "@/components/negocios/percentual-profissional";
import { ServicosVendidos } from "@/components/negocios/servicos-vendidos";
import { ProfissionaisVendas } from "@/components/negocios/profissionais-vendas";

// Aba "Negócios" — a visão financeira, e onde o layout novo está sendo testado.
//
// O hook é o mesmo do Dashboard (a outra aba). Não é fetch duplicado: mesma
// queryKey, mesmo cache, uma requisição só.

const CARDS: ReadonlyArray<{
  chave: "criado" | "ganho" | "perdido" | "aberto" | "recuperado";
  rotulo: string;
  icone: typeof Plus;
  tom: TomKpi;
  apoio: (qtd: number) => string;
  serie: SerieId | null;
  dica: string;
}> = [
  {
    chave: "criado",
    rotulo: "Total criado",
    icone: Plus,
    tom: "base",
    // "agendamentos" aqui era ambíguo: lia-se como "consultas de hoje", mas o
    // recorte é `criado_em` — quando a marcação FOI FEITA, não quando ela
    // acontece. Em 10/08 foram 32 marcações feitas e só 9 atendimentos no dia.
    apoio: (q) => `${q} marcaç${q === 1 ? "ão" : "ões"}`,
    serie: "criado",
    dica: "Tudo que entrou no funil no período, pela data em que foi marcado.",
  },
  {
    chave: "ganho",
    rotulo: "Total ganhos",
    icone: TrendingUp,
    tom: "sobe",
    apoio: (q) => `${q} realizado${q === 1 ? "" : "s"}`,
    serie: "ganho",
    dica: "Procedimentos que aconteceram no período.",
  },
  {
    chave: "perdido",
    rotulo: "Total perdidos",
    icone: TrendingDown,
    tom: "desce",
    apoio: (q) => `${q} cancelado${q === 1 ? "" : "s"}`,
    serie: "perdido",
    dica: "Cancelados que teriam acontecido no período.",
  },
  {
    chave: "aberto",
    rotulo: "Total em aberto",
    icone: Activity,
    tom: "aberto",
    apoio: (q) => `${q} marcado${q === 1 ? "" : "s"}`,
    serie: null,
    dica:
      "Marcados que ainda vão acontecer. Não segue o filtro de período: aberto é situação de agora, não recorte do passado.",
  },
  {
    chave: "recuperado",
    rotulo: "Receita recuperada",
    icone: RotateCcw,
    tom: "recuperado",
    apoio: (q) => `${q} pelo follow-up`,
    serie: null,
    dica:
      "Atendimento realizado por cliente que marcou em até 7 dias depois de receber um follow-up (a regra é da view follow_ups_resultado). Hoje nenhum follow-up converteu, então o zero é real.",
  },
];

export function Negocios({ period }: { period: string }) {
  const agendQuery = useAgendamentosComLead();
  const agendamentos = useMemo(() => agendQuery.data ?? [], [agendQuery.data]);

  // Preços vêm do catálogo da clínica (documentos_lins), não de tabela no
  // código. Enquanto carrega, as somas ficam zeradas em vez de chutadas.
  const catalogoQ = useCatalogoServicos();
  const escalaQ = useEscala();
  const followQ = useFollowUps();
  const precos = useMemo(
    () => ({
      catalogo: catalogoQ.data?.servicos ?? [],
      promocoes: catalogoQ.data?.promocoes ?? [],
    }),
    [catalogoQ.data]
  );
  const carregando = agendQuery.isPending;

  const [selecionado, setSelecionado] = useState<string | null>("criado");
  const [modo, setModo] = useState<Modo>("valor");
  const [destaqueManual, setDestaqueManual] = useState<SerieId | null>(null);
  // Um seletor POR PAINEL, com estado próprio: a base do gráfico de linhas e a
  // do ranking são perguntas diferentes, e amarrá-las num controle global
  // obrigaria a trocar o recorte inteiro para ver "quantos" em vez de "quanto".
  const [modoProf, setModoProf] = useState<Modo>("valor");
  const [modoServ, setModoServ] = useState<Modo>("valor");

  const resumo = useMemo(
    () => resumoFinanceiro(agendamentos, period, precos),
    [agendamentos, period, precos]
  );
  const pontos = useMemo(
    () => serieDiaria(agendamentos, period, precos),
    [agendamentos, period, precos]
  );
  // Quem atendeu vem da ESCALA, não de hash: nunca se atribui atendimento a
  // quem não estava trabalhando. Com uma profissional de plantão a atribuição é
  // exata; com várias, o valor é rateado em partes iguais — estimador sem viés,
  // e a soma continua fechando com o faturamento.
  const atribuicao = useMemo(() => {
    const realizados = filterByDate(agendamentos, "data_agendamento", period)
      .filter((a) => a.status === "realizado");
    return atribuirPorEscala(
      realizados.map((a) => ({
        data_agendamento: a.data_agendamento,
        valor: valorDe(a, precos),
      })),
      escalaQ.data?.horarios ?? [],
      escalaQ.data?.profissionais ?? []
    );
  }, [agendamentos, period, precos, escalaQ.data]);
  const fatias = atribuicao.fatias;

  // Receita recuperada: atendimento REALIZADO de um lead que marcou dentro de
  // 7 dias após receber um follow-up. Mesma regra da view; aqui precisamos do
  // agendamento em si para somar o valor, e a view só devolve o instante.
  const recuperado = useMemo(() => {
    const fus = followQ.data ?? [];
    if (fus.length === 0) return { valor: 0, qtd: 0 };
    const convertidos = fus.filter((fu) => fu.resultado === "convertido");
    let valor = 0;
    let qtd = 0;
    const noPeriodo = filterByDate(agendamentos, "data_agendamento", period);
    for (const a of noPeriodo) {
      if (a.status !== "realizado") continue;
      const casou = convertidos.some(
        (fu) => fu.lead_id === a.lead_id && fu.agendou_em === a.criado_em
      );
      if (!casou) continue;
      valor += valorDe(a, precos) ?? 0;
      qtd += 1;
    }
    return { valor, qtd };
  }, [followQ.data, agendamentos, period, precos]);
  const servicos = useMemo(
    () => rankingServicos(agendamentos, period, precos),
    [agendamentos, period, precos]
  );

  const ticket = useMemo(
    () => contarSemPreco(agendamentos, period, precos),
    [agendamentos, period, precos]
  );

  // A ressalva de preço deixa de ser tarja e entra no (i) dos cards que ela
  // afeta — os que somam dinheiro do período. Uma faixa amarela permanente no
  // topo é obra em andamento na cara de quem paga; o (i) fica à mão de quem
  // quiser conferir de onde veio o número.
  const ressalva =
    !carregando && ticket.semPreco > 0
      ? ` Preços vêm do catálogo da clínica; ${ticket.semPreco} de ${ticket.total} atendimentos não dizem qual serviço foi feito e ficam de fora da soma, então o total é piso.`
      : "";

  const janela =
    pontos.length > 0
      ? `${pontos[0].rotulo} a ${pontos[pontos.length - 1].rotulo}`
      : "";

  // A legenda tem precedência sobre o card: quem clicou por último manda.
  const destaque =
    destaqueManual ??
    CARDS.find((c) => c.chave === selecionado)?.serie ??
    null;

  return (
    <div className="neg-fill">
      <div className="neg-grid">
        {CARDS.map((c) => {
          // "recuperado" não sai mais do resumo (que o derivava por hash):
          // vem dos follow-ups que de fato converteram.
          const faixa = c.chave === "recuperado" ? recuperado : resumo[c.chave];
          return (
            <KpiCard
              key={c.chave}
              rotulo={c.rotulo}
              valor={carregando ? "—" : moeda(faixa.valor)}
              apoio={carregando ? " " : c.apoio(faixa.qtd)}
              icone={c.icone}
              tom={c.tom}
              dica={c.dica + ressalva}
              ativo={selecionado === c.chave}
              onSelecionar={() => {
                setSelecionado(selecionado === c.chave ? null : c.chave);
                setDestaqueManual(null);
              }}
            />
          );
        })}
      </div>

      <div className="neg-secao-2">
        <section className="neg-painel">
          <header className="neg-painel-topo">
            <div>
              <h2 className="neg-painel-titulo">Dados diários</h2>
              <span className="neg-painel-nota">
                Por {modo === "valor" ? "valor" : "quantidade"}
                {/* A janela do gráfico nem sempre é igual à do filtro: em
                    "Hoje" ela abre para 7 dias (um ponto sozinho não desenha
                    nada) e nunca passa de hoje. Mostrar o intervalo tira a
                    ambiguidade em vez de explicar. */}
                {janela ? ` · ${janela}` : ""}
              </span>
            </div>
            <div className="neg-painel-acoes">
              <LegendaSeries
                destaque={destaque}
                onDestacar={(s) => {
                  setDestaqueManual(s);
                  setSelecionado(null);
                }}
              />
              <Segmentado
                opcoes={VALOR_QTD}
                valor={modo}
                onChange={(v) => setModo(v as Modo)}
                rotuloAcessivel="Base do gráfico"
              />
            </div>
          </header>
          {carregando ? (
            <div className="neg-vazio">Carregando…</div>
          ) : (
            <DadosDiarios pontos={pontos} modo={modo} destaque={destaque} />
          )}
        </section>

        <section className="neg-painel">
          <header className="neg-painel-topo">
            <div>
              <h2 className="neg-painel-titulo">
                Percentual por profissional
              </h2>
              {/* Diz de onde vem o número em vez de rotular. `profissional_id`
                  é nulo, então quem atendeu sai da ESCALA: com uma de plantão a
                  atribuição é exata; com várias, o valor é rateado entre elas.
                  Mostrar a proporção é o que permite ler o gráfico certo. */}
              <span className="neg-painel-nota">
                {atribuicao.exatos + atribuicao.rateados === 0
                  ? "Pela escala de quem estava de plantão"
                  : `Pela escala · ${atribuicao.exatos} exatos, ${atribuicao.rateados} rateados`}
              </span>
            </div>
            <div className="neg-painel-acoes">
              <Segmentado
                opcoes={VALOR_QTD}
                valor={modoProf}
                onChange={(v) => setModoProf(v as Modo)}
                rotuloAcessivel="Base da divisão por profissional"
              />
            </div>
          </header>
          {carregando ? (
            <div className="neg-vazio">Carregando…</div>
          ) : (
            <PercentualProfissional fatias={fatias} modo={modoProf} />
          )}
        </section>
      </div>

      <div className="neg-secao-2 par">
        <section className="neg-painel">
          <header className="neg-painel-topo">
            <div>
              <h2 className="neg-painel-titulo">Serviços mais vendidos</h2>
              <span className="neg-painel-nota">Procedimentos realizados</span>
            </div>
            <div className="neg-painel-acoes">
              <Segmentado
                opcoes={VALOR_QTD}
                valor={modoServ}
                onChange={(v) => setModoServ(v as Modo)}
                rotuloAcessivel="Base do ranking de serviços"
              />
            </div>
          </header>
          {carregando ? (
            <div className="neg-vazio">Carregando…</div>
          ) : (
            <ServicosVendidos linhas={servicos} modo={modoServ} />
          )}
        </section>

        <section className="neg-painel">
          <header className="neg-painel-topo">
            <div>
              <h2 className="neg-painel-titulo">Profissionais com mais vendas</h2>
              <span className="neg-painel-nota">Valor e ticket médio</span>
            </div>
          </header>
          {carregando ? (
            <div className="neg-vazio">Carregando…</div>
          ) : (
            <ProfissionaisVendas fatias={fatias} />
          )}
        </section>
      </div>
    </div>
  );
}
