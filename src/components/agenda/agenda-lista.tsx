"use client";

import { useMemo, useState } from "react";
import { nomesDoAgendamento } from "@/lib/nome-agendamento";
import { ChevronDown, List } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { StatusBadge } from "@/components/status-badge";
import { limparServico } from "@/lib/format";
import type { AgendamentoComLead } from "@/types/db";

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/**
 * Lista de agendamentos do período visível, abaixo da grade.
 *
 * Existe por dois motivos:
 *  1. Na grade, uma célula com 3 atendimentos vira três cartões estreitos —
 *     dá para ver que existem, mas não para ler o serviço inteiro.
 *  2. No celular a grade de 7 colunas é apertada; a lista é o jeito confortável
 *     de conferir o dia.
 *
 * Fechada por padrão para não empurrar a grade — o contador no cabeçalho já
 * diz quantos há.
 */
export function AgendaLista({
  agendamentos,
  onEventClick,
}: {
  agendamentos: AgendamentoComLead[];
  onEventClick: (a: AgendamentoComLead) => void;
}) {
  const [aberta, setAberta] = useState(false);

  // Agrupa por dia, em ordem cronológica. Cancelados entram (é histórico do
  // período), mas ficam apagados.
  const porDia = useMemo(() => {
    const mapa = new Map<string, AgendamentoComLead[]>();
    const ordenados = [...agendamentos].sort(
      (a, b) =>
        new Date(a.data_agendamento).getTime() -
        new Date(b.data_agendamento).getTime()
    );
    for (const a of ordenados) {
      if (!a.data_agendamento) continue;
      const d = new Date(a.data_agendamento);
      const chave = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = mapa.get(chave);
      if (arr) arr.push(a);
      else mapa.set(chave, [a]);
    }
    return [...mapa.entries()];
  }, [agendamentos]);

  const total = agendamentos.length;

  return (
    <div className="ag-lista">
      <button
        className="ag-lista-cab"
        onClick={() => setAberta((o) => !o)}
        aria-expanded={aberta}
      >
        <List size={15} strokeWidth={1.6} />
        <span className="ag-lista-titulo">Lista de agendamentos</span>
        <span className="ag-lista-contador">{total}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.6}
          className={`ag-lista-chev${aberta ? " aberta" : ""}`}
        />
      </button>

      {aberta &&
        (total === 0 ? (
          <p className="ag-lista-vazio">Nenhum agendamento neste período.</p>
        ) : (
          <>
            {/* Cabeçalho fora do corpo rolante: fica fixo enquanto a lista rola */}
            <div className="ag-lista-thead">
              <span className="ag-lista-hora">Horário</span>
              <span className="ag-lista-th-cliente">Cliente</span>
              <span className="ag-lista-th-servico">Procedimento</span>
              <span className="ag-lista-th-status">Status</span>
            </div>
            <div className="ag-lista-corpo">
            {porDia.map(([chave, doDia]) => {
              const d = new Date(doDia[0].data_agendamento);
              return (
                <div key={chave} className="ag-lista-dia">
                  <div className="ag-lista-dia-cab">
                    <span className="ag-lista-dia-num">{d.getDate()}</span>
                    <span className="ag-lista-dia-mes">
                      {MESES[d.getMonth()]}
                    </span>
                    <span className="ag-lista-dia-nome">{DIAS[d.getDay()]}</span>
                    <span className="ag-lista-dia-qtd">
                      {doDia.length}{" "}
                      {doDia.length === 1 ? "atendimento" : "atendimentos"}
                    </span>
                  </div>

                  {doDia.map((a) => {
                    const dt = new Date(a.data_agendamento);
                    const hora = dt.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const cancelado = a.status === "cancelado";
                    return (
                      <button
                        key={a.id}
                        className={`ag-lista-item${cancelado ? " cancelado" : ""}`}
                        onClick={() => onEventClick(a)}
                      >
                        <span className="ag-lista-hora">{hora}</span>
                        <Avatar
                          nome={a.leads?.nome}
                          fotoUrl={a.leads?.foto_url}
                          size={28}
                          fontSize={10}
                        />
                        <span className="ag-lista-nome">
                          {nomesDoAgendamento(a.nome_cliente, a.leads?.nome)
                            .exibido ||
                            a.leads?.telefone ||
                            "Cliente"}
                        </span>
                        <span className="ag-lista-servico">
                          {limparServico(a.servico)}
                        </span>
                        {/* Largura fixa para alinhar com o cabeçalho "Status" */}
                        <span className="ag-lista-status">
                          <StatusBadge status={a.status} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            </div>
          </>
        ))}
    </div>
  );
}
