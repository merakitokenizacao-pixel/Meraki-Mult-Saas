"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Info,
  Plus,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useAgendamentosComLead } from "@/lib/hooks";
import {
  FINANCEIRO_ESTIMADO,
  moeda,
  porProfissional,
  rankingServicos,
  resumoFinanceiro,
  serieDiaria,
  contarTicketPadrao,
} from "@/lib/financeiro";
import { KpiCard, type TomKpi } from "@/components/negocios/kpi-card";
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
  selo?: string;
  dica: string;
}> = [
  {
    chave: "criado",
    rotulo: "Total criado",
    icone: Plus,
    tom: "blue",
    // "agendamentos" aqui era ambíguo: lia-se como "consultas de hoje", mas o
    // recorte é `criado_em` — quando a marcação FOI FEITA, não quando ela
    // acontece. Em 10/08 foram 32 marcações feitas e só 9 atendimentos no dia.
    apoio: (q) => `${q} marcaç${q === 1 ? "ão feita" : "ões feitas"}`,
    serie: "criado",
    dica: "Tudo que entrou no funil no período, pela data em que foi marcado.",
  },
  {
    chave: "ganho",
    rotulo: "Total ganhos",
    icone: TrendingUp,
    tom: "green",
    apoio: (q) => `${q} realizado${q === 1 ? "" : "s"}`,
    serie: "ganho",
    dica: "Procedimentos que aconteceram no período.",
  },
  {
    chave: "perdido",
    rotulo: "Total perdidos",
    icone: TrendingDown,
    tom: "red",
    apoio: (q) => `${q} cancelado${q === 1 ? "" : "s"}`,
    serie: "perdido",
    dica: "Cancelados que teriam acontecido no período.",
  },
  {
    chave: "aberto",
    rotulo: "Total em aberto",
    icone: Activity,
    tom: "accent",
    apoio: (q) => `${q} marcado${q === 1 ? "" : "s"}`,
    serie: null,
    selo: "agora",
    dica:
      "Marcados que ainda vão acontecer. Não segue o filtro de período: aberto é situação de agora, não recorte do passado.",
  },
  {
    chave: "recuperado",
    rotulo: "Receita recuperada",
    icone: RotateCcw,
    tom: "purple",
    apoio: (q) => `${q} pelo follow-up`,
    serie: null,
    selo: "simulado",
    dica:
      "Cliente que voltou depois de um follow-up. Ainda não existe coluna que marque isso — este é o card que mais depende da tabela nova.",
  },
];

export function Negocios({ period }: { period: string }) {
  const agendQuery = useAgendamentosComLead();
  const agendamentos = useMemo(() => agendQuery.data ?? [], [agendQuery.data]);
  const carregando = agendQuery.isPending;

  const [selecionado, setSelecionado] = useState<string | null>("criado");
  const [modo, setModo] = useState<Modo>("valor");
  const [destaqueManual, setDestaqueManual] = useState<SerieId | null>(null);

  const resumo = useMemo(
    () => resumoFinanceiro(agendamentos, period),
    [agendamentos, period]
  );
  const pontos = useMemo(
    () => serieDiaria(agendamentos, period),
    [agendamentos, period]
  );
  const fatias = useMemo(
    () => porProfissional(agendamentos, period),
    [agendamentos, period]
  );
  const servicos = useMemo(
    () => rankingServicos(agendamentos, period),
    [agendamentos, period]
  );

  const ticket = useMemo(
    () => contarTicketPadrao(agendamentos, period),
    [agendamentos, period]
  );

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
      {FINANCEIRO_ESTIMADO && (
        <div className="neg-aviso" role="note">
          <Info size={15} strokeWidth={1.8} />
          <div>
            <strong>Valores estimados.</strong> Os agendamentos são reais — quais,
            quando, com que status e serviço. Já os <em>preços</em> vêm de uma
            tabela baseada nas promoções da clínica (a coluna{" "}
            <code>agendamentos.valor</code> está vazia), e a divisão{" "}
            <em>por profissional</em> é sintética, porque não existe vínculo no
            banco ainda. Nada aqui serve para fechar caixa.
            {/* O pedaço mais frouxo da estimativa merece número, não adjetivo:
                são linhas de importação ("agenda legada", "caderninho", "Outro")
                que aconteceram de verdade mas não dizem o que foi feito, e
                entram todas pelo mesmo ticket padrão. */}
            {ticket.padrao > 0 && (
              <>
                {" "}
                Destes, <strong>{ticket.padrao} de {ticket.total}</strong>{" "}
                atendimentos não têm serviço identificado e entram por um ticket
                padrão de R$ 100.
              </>
            )}
          </div>
        </div>
      )}

      <div className="neg-grid">
        {CARDS.map((c) => {
          const faixa = resumo[c.chave];
          return (
            <KpiCard
              key={c.chave}
              rotulo={c.rotulo}
              valor={carregando ? "—" : moeda(faixa.valor)}
              apoio={carregando ? " " : c.apoio(faixa.qtd)}
              icone={c.icone}
              tom={c.tom}
              dica={c.dica}
              selo={c.selo}
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
              <select
                className="neg-select"
                value={modo}
                onChange={(e) => setModo(e.target.value as Modo)}
                aria-label="Base do gráfico"
              >
                <option value="valor">Valor</option>
                <option value="qtd">Quantidade</option>
              </select>
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
                {/* O único widget da tela sem NENHUM lastro: `profissional_id`
                    é nulo em 303 de 303 agendamentos, então a divisão é gerada
                    por hash. Sem selo, uma rosca com nomes e percentuais é lida
                    como fato — é a peça mais fácil de acreditar por engano. */}
                <span className="neg-selo">sintético</span>
              </h2>
              <span className="neg-painel-nota">
                Não há vínculo de profissional no banco ainda
              </span>
            </div>
          </header>
          {carregando ? (
            <div className="neg-vazio">Carregando…</div>
          ) : (
            <PercentualProfissional fatias={fatias} />
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
          </header>
          {carregando ? (
            <div className="neg-vazio">Carregando…</div>
          ) : (
            <ServicosVendidos linhas={servicos} />
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
