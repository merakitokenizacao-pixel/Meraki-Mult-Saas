import { filterByDate } from "@/lib/date";
import type { Lead, Agendamento } from "@/types/db";

// Completa o título de cada lente ("Quem chegou nesta semana"), para o cabeçalho
// acompanhar o filtro em vez de dizer sempre "no período".
const FRASE_PERIODO: Record<string, string> = {
  hoje: "hoje",
  ontem: "ontem",
  semana: "nesta semana",
  "7d": "nos últimos 7 dias",
  "30d": "nos últimos 30 dias",
  mes: "neste mês",
  tudo: "no total",
};

// Replica renderDashboardMetrics: 4 KPIs reagindo ao período selecionado.
export function MetricsGrid({
  leads,
  agendamentos,
  period,
  responderam,
}: {
  leads: Lead[];
  agendamentos: Agendamento[];
  period: string;
  /** Quem escreveu para a clínica pelo menos uma vez. `null` = ainda
   *  carregando; aí o número fica em "—" em vez de mostrar o total inflado
   *  por um instante. */
  responderam: Set<string> | null;
}) {
  const frasePeriodo = FRASE_PERIODO[period] ?? "no período";
  const noPeriodo = filterByDate(leads, "criado_em", period);

  // CAPTADO = quem FALOU com a clínica.
  //
  // A dona disparou para a lista antiga de contatos dela, e esses números
  // entraram em `leads`. Contá-los aqui dizia "509 clientes captados em 7
  // dias" quando só 37 tinham respondido — e afundava a taxa de conversão para
  // 1%, porque o denominador estava cheio de gente que nunca abriu a boca.
  // Quem recebeu disparo e ficou mudo não foi captado: a clínica falou com ele,
  // ele não falou com a clínica.
  const filtered = responderam
    ? noPeriodo.filter((l) => responderam.has(l.id))
    : noPeriodo;
  const total = filtered.length;
  const soDisparo = noPeriodo.length - filtered.length;

  // Taxa de conversão = DOS LEADS CAPTADOS NO PERÍODO, quantos AGENDARAM.
  // (Coorte: denominador = captados no período; o agendamento deles pode ter
  // sido feito a qualquer momento, por isso o numerador olha TODOS os
  // agendamentos, não só os do período.)
  //
  // O sinal "agendou" NÃO mora mais em `leads.status`: o novo ciclo de vida só
  // grava novo/cliente/inativo, e a conta antiga procurava 'agendado'/
  // 'convertido' ali — gaveta que ficou vazia, então dava 0% sempre. O sinal
  // migrou para a tabela `agendamentos`; é de lá que ele é derivado agora.
  const leadsQueAgendaram = new Set(
    agendamentos.map((a) => a.lead_id).filter(Boolean)
  );
  const agendaram = filtered.filter((l) => leadsQueAgendaram.has(l.id)).length;
  // Sem leads captados no período não existe taxa (0/0) — mostra "—", não 0%.
  const temTaxa = total > 0;
  const taxa = temTaxa ? Math.round((agendaram / total) * 100) : 0;

  // "Consultas agendadas" e "Receita estimada" usam o MESMO conjunto:
  // agendamentos por DATA_AGENDAMENTO (quando o atendimento ACONTECE), sem
  // cancelados.
  //
  // Já foi por `criado_em` (quando a consulta foi MARCADA). Trocado em jul/2026
  // porque a leitura operacional é a que a dona espera: num domingo — primeiro
  // dia da semana — nada tinha sido marcado ainda, e o card mostrava "Semana: 0"
  // enquanto havia 29 atendimentos acontecendo naquela semana. Contar por
  // criado_em respondia "quanto a Laura captou"; o card responde agora "quanto
  // trabalho eu tenho no período", que é o que se olha num painel de operação.
  const agendsPeriodo =
    period === "tudo"
      ? agendamentos
      : filterByDate(agendamentos, "data_agendamento", period);
  const naoCancelados = agendsPeriodo.filter((a) => a.status !== "cancelado");
  const consultasAgendadas = naoCancelados.length;
  const receita = naoCancelados
    .filter((a) => a.valor)
    .reduce((sum, a) => sum + parseFloat(String(a.valor ?? 0)), 0);
  const receitaFmt =
    receita > 0
      ? receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "R$ 0,00";
  // Só encolhe quando a string é mesmo longa. Com o valor em 30px (e não nos
  // 46px de antes) o degrau agressivo virava três tamanhos de fonte no mesmo
  // grid, e cards vizinhos com alturas de número diferentes desalinham a linha.
  const receitaSize = receita >= 100000 ? "24px" : undefined;

  return (
    <div className="metrics-dupla">
      {/* ── LENTE 1: quem CHEGOU no período ───────────────────────────────
          Estes dois falam da mesma população: as pessoas captadas na janela.
          Separados dos outros de propósito — as consultas do período foram
          marcadas por gente que chegou semanas atrás, então comparar "3
          clientes captados" com "35 consultas" não quer dizer nada. Antes os
          quatro cards eram idênticos e o olho comparava o incomparável. */}
      <section className="metrics-lente">
        <h2 className="metrics-lente-titulo">Quem chegou {frasePeriodo}</h2>
        <div className="metrics-grid-2">
          <div className="metric-card">
            <div className="metric-label">Clientes captados</div>
            <div className="metric-value">{responderam ? total : "—"}</div>
            {/* O número de quem só recebeu disparo não some — ele vira o
                subtexto. Sumir com ele faria a dona achar que a lista dela
                não entrou no sistema. */}
            <div className="metric-sub">
              {soDisparo > 0
                ? `+${soDisparo} só receberam mensagem`
                : "via WhatsApp"}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Taxa de conversão</div>
            {/* Sem cor no número: seis matizes na tela faziam a cor virar
                enfeite. Aqui ela não distinguia nada — o rótulo já diz o que
                é, e "amarelo" não significa taxa. */}
            <div className="metric-value">
              {temTaxa ? (
                <>
                  {taxa}
                  <span className="metric-unidade">%</span>
                </>
              ) : (
                "—"
              )}
            </div>
            {/* A fração fica visível de propósito: numa janela curta a taxa é
                de poucas pessoas (1 de 3 = 33%), e o número sozinho pareceria
                mais sólido do que é. */}
            <div className="metric-sub">
              {temTaxa
                ? `${agendaram} de ${total} captados agendaram`
                : "nenhum cliente captado no período"}
            </div>
          </div>
        </div>
      </section>

      {/* ── LENTE 2: o que ACONTECE no período ── */}
      <section className="metrics-lente">
        <h2 className="metrics-lente-titulo">Atendimentos {frasePeriodo}</h2>
        <div className="metrics-grid-2">
          <div className="metric-card">
            <div className="metric-label">Consultas agendadas</div>
            <div className="metric-value">{consultasAgendadas}</div>
            {/* O subtítulo antigo dizia "clientes confirmados" — errado em dois
                sentidos: conta atendimentos (não pessoas) e inclui os pendentes. */}
            <div className="metric-sub">marcados para o período</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Receita estimada</div>
            <div className="metric-value" style={{ fontSize: receitaSize }}>
              {receitaFmt}
            </div>
            <div className="metric-sub">nesses atendimentos</div>
          </div>
        </div>
      </section>
    </div>
  );
}
