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
  ROTULO_GRANULARIDADE,
  serieDoPeriodo,
  contarSemPreco,
  valorDe,
} from "@/lib/financeiro";
import { filterByDate } from "@/lib/date";
import {
  KpiCard,
  TOKEN_DO_TOM,
  type TomKpi,
} from "@/components/negocios/kpi-card";
import {
  DadosDiarios,
  type Modo,
  type SerieId,
} from "@/components/negocios/dados-diarios";
import { OPCOES_BASE, Segmentado } from "@/components/segmentado";
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
  /**
   * `null` = sem `ⓘ`. Ajuda em tudo é ajuda em nada: com os cinco marcados o
   * ícone virava parte do desenho e ninguém o lia. Ficam os dois que não se
   * explicam pelo rótulo.
   *
   * ⚠️ A ressalva de preço (atendimentos sem serviço no catálogo, que ficam
   * de fora da soma) viajava junto de TODAS as dicas. Agora ela só aparece
   * nestes dois — e os dois somam dinheiro do catálogo, então continua no
   * lugar certo. `criado`, `ganho` e `perdido` também somam e deixaram de
   * mostrá-la: é o preço de não ter `ⓘ`.
   */
  dica: string | null;
}> = [
  {
    chave: "criado",
    rotulo: "Total criado",
    icone: Plus,
    // Era `neutro` (tinta-média). Cinza não serve como borda de seleção: não
    // marca nada. É a entrada do funil, e a entrada é a marca.
    tom: "acento",
    // "agendamentos" aqui era ambíguo: lia-se como "consultas de hoje", mas o
    // recorte é `criado_em` — quando a marcação FOI FEITA, não quando ela
    // acontece. Em 10/08 foram 32 marcações feitas e só 9 atendimentos no dia.
    apoio: (q) => `${q} marcaç${q === 1 ? "ão feita" : "ões feitas"}`,
    serie: "criado",
    dica: null,
  },
  {
    chave: "ganho",
    rotulo: "Total ganhos",
    icone: TrendingUp,
    tom: "resolvido",
    apoio: (q) => `${q} realizado${q === 1 ? "" : "s"}`,
    serie: "ganho",
    dica: null,
  },
  {
    chave: "perdido",
    rotulo: "Total perdidos",
    icone: TrendingDown,
    tom: "erro",
    apoio: (q) => `${q} cancelado${q === 1 ? "" : "s"}`,
    serie: "perdido",
    dica: null,
  },
  {
    chave: "aberto",
    rotulo: "Total em aberto",
    icone: Activity,
    tom: "agendado",
    apoio: (q) => `${q} marcado${q === 1 ? "" : "s"}`,
    serie: null,
    dica:
      "Marcados que ainda vão acontecer. Não segue o filtro de período: aberto é situação de agora, não recorte do passado.",
  },
  {
    chave: "recuperado",
    rotulo: "Receita recuperada",
    icone: RotateCcw,
    // Âmbar, não o acento: o acento agora é a cor de "Total criado", e dois
    // cards com a mesma borda de seleção não distinguiriam um do outro.
    tom: "atendendo",
    apoio: (q) => `${q} pelo follow-up`,
    serie: null,
    dica:
      "Atendimento realizado por cliente que marcou em até 7 dias depois de receber um follow-up (a regra é da view follow_ups_resultado). Hoje nenhum follow-up converteu, então o zero é real.",
  },
];

export function Negocios({ period }: { period: string }) {
  const agendQuery = useAgendamentosComLead();
  const agendamentos = useMemo(() => agendQuery.data ?? [], [agendQuery.data]);

  // Preços vêm do catálogo da clínica (documentos), não de tabela no
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

  // Padrão: o primeiro card. A seleção persiste enquanto a pessoa estiver na
  // tela — é ela que diz o que o gráfico abaixo está mostrando.
  const [selecionado, setSelecionado] = useState<string | null>("criado");
  const [modo, setModo] = useState<Modo>("valor");
  // Dois dos cinco cards não têm série no gráfico ("em aberto" e "recuperada"
  // são situação de agora, não série no tempo). Selecionar um deles NÃO pode
  // zerar o gráfico nem jogá-lo sempre para "ganhos": ele mantém a última
  // série escolhida de fato.
  const [ultimaSerie, setUltimaSerie] = useState<SerieId>("criado");
  // Um seletor POR PAINEL, com estado próprio: a base do gráfico de linhas e a
  // do ranking são perguntas diferentes, e amarrá-las num controle global
  // obrigaria a trocar o recorte inteiro para ver "quantos" em vez de "quanto".
  const [modoProf, setModoProf] = useState<Modo>("valor");
  const [modoServ, setModoServ] = useState<Modo>("valor");

  const resumo = useMemo(
    () => resumoFinanceiro(agendamentos, period, precos),
    [agendamentos, period, precos]
  );
  // A série já vem na granularidade certa: 3 meses viram ~13 pontos, não 90.
  // Com 90 pontos em 969px são 3,6px por dia, e nenhum tratamento de traço
  // salva isso — ruído desenhado com gradiente continua sendo ruído.
  const serie = useMemo(
    () => serieDoPeriodo(agendamentos, period, precos),
    [agendamentos, period, precos]
  );
  const pontos = serie.pontos;
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

  const cardAtivo = CARDS.find((c) => c.chave === selecionado) ?? null;
  const destaque: SerieId = cardAtivo?.serie ?? ultimaSerie;
  // A linha protagonista assume a COR DO CARD, não uma cor própria da série.
  // É o que amarra a seleção ao gráfico: a borda acesa e a linha em destaque
  // são a mesma cor porque saem do mesmo token.
  const corDestaque =
    TOKEN_DO_TOM[
      CARDS.find((c) => c.serie === destaque)?.tom ?? "acento"
    ];

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
              dica={c.dica ? c.dica + ressalva : undefined}
              ativo={selecionado === c.chave}
              onSelecionar={() => {
                setSelecionado(selecionado === c.chave ? null : c.chave);
                if (c.serie) setUltimaSerie(c.serie);
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
                {/* E a granularidade: sem ela, "R$ 4.200" num ponto de semana
                    é lido como um dia. */}
                {` · ${ROTULO_GRANULARIDADE[serie.granularidade]}`}
              </span>
            </div>
            <div className="neg-painel-acoes">
              <Segmentado
                valor={modo}
                onChange={setModo}
                opcoes={OPCOES_BASE}
                rotulo="Base do gráfico"
              />
            </div>
          </header>
          {carregando ? (
            <div className="neg-vazio">Carregando…</div>
          ) : (
            <DadosDiarios
              pontos={pontos}
              modo={modo}
              destaque={destaque}
              corDestaque={corDestaque}
            />
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
                valor={modoProf}
                onChange={setModoProf}
                opcoes={OPCOES_BASE}
                rotulo="Base da divisão por profissional"
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
                valor={modoServ}
                onChange={setModoServ}
                opcoes={OPCOES_BASE}
                rotulo="Base do ranking de serviços"
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
