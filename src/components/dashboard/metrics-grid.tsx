import { filterByDate } from "@/lib/date";
import { valorDe, type Precos } from "@/lib/financeiro";
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
  precos,
}: {
  leads: Lead[];
  agendamentos: Agendamento[];
  period: string;
  /** Quem escreveu para a clínica pelo menos uma vez. `null` = ainda
   *  carregando; aí o número fica em "—" em vez de mostrar o total inflado
   *  por um instante. */
  responderam: Set<string> | null;
  /** Catálogo da clínica, para precificar pelo serviço. */
  precos: Precos;
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
  const taxaResposta = noPeriodo.length
    ? Math.round((total / noPeriodo.length) * 100)
    : 0;

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
  // `agendamentos.valor` está vazio em 386 de 386 linhas — o n8n nunca
  // preencheu. Mas 386 de 386 têm SERVIÇO, e o preço do serviço mora em
  // `documentos_lins`, a mesma base que a Laura lê no WhatsApp.
  //
  // `valorDe` é exatamente essa regra e já é usada na aba Negócios: usa
  // `a.valor` quando existe e cai no catálogo quando não. Repetir a conta aqui
  // faria as duas abas divergirem no primeiro reajuste de preço.
  let receita = 0;
  let semPreco = 0;
  for (const a of naoCancelados) {
    const v = valorDe(a, precos);
    if (v == null) semPreco++;
    else receita += v;
  }
  const receitaFmt =
    receita > 0
      ? receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "R$ 0,00";

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
            {/* Antes esta linha dizia "+651 só receberam mensagem": punha um
                sinal de MAIS na frente do que não aconteceu, e o card é sobre
                quem chegou. A mesma informação vira taxa de resposta — que é
                o que a dona faz com ela: decidir se vale disparar de novo. */}
            <div className="metric-sub">
              {soDisparo > 0
                ? `${taxaResposta}% de ${total + soDisparo} contatados responderam`
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
            {/* Já teve um degrau de fonte aqui (24px acima de 100 mil), de
                quando o valor era 30px. Com 26px ele deixou de fazer sentido:
                `R$ 128.400,50` mede 177px nos 266px úteis do card, e um único
                card com número menor que os vizinhos desalinha a linha para
                resolver um problema que não existe mais. */}
            <div className="metric-value">{receitaFmt}</div>
            {/* Quantos ficaram de fora da soma: o serviço deles não está no
                catálogo (Botox e Preenchimento, por exemplo), então o total é
                PISO. Sem esta linha, o número seria lido como fechamento. */}
            <div className="metric-sub">
              {semPreco > 0
                ? `${consultasAgendadas - semPreco} de ${consultasAgendadas} com preço no catálogo`
                : "nesses atendimentos"}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
