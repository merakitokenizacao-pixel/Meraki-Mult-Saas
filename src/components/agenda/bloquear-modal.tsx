"use client";

import { useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Modal } from "@/components/modal";
import { showToast } from "@/lib/toast";
import {
  conflitosNoPeriodo,
  criarBloqueios,
  type NovoBloqueio,
} from "@/lib/bloqueios";
import type { AgendamentoComLead } from "@/types/db";

// Bloquear horário: o caminho que faltava e que fazia a dona criar agendamento
// falso no próprio nome. Aquilo caía em `agendamentos` e subia atendimento,
// conversão e receita — aqui não encosta na tabela.

export interface ProfissionalOpcao {
  id: string;
  nome: string;
  ativo: boolean;
}

const TODAS = "__todas__";

export function BloquearModal({
  aberto,
  onClose,
  onSalvo,
  profissionais,
  agendamentos,
  dataInicial,
  horaInicial,
}: {
  aberto: boolean;
  onClose: () => void;
  onSalvo: () => void;
  profissionais: ProfissionalOpcao[];
  /** Para o aviso de sobreposição — os do período que a Agenda já carregou. */
  agendamentos: AgendamentoComLead[];
  dataInicial: string;
  /** "10:00" quando veio de um slot; vazio quando veio do botão. */
  horaInicial: string;
}) {
  const ativas = useMemo(
    () => profissionais.filter((p) => p.ativo),
    [profissionais]
  );

  const [quem, setQuem] = useState<string>(TODAS);
  const [data, setData] = useState(dataInicial);
  const [diaInteiro, setDiaInteiro] = useState(!horaInicial);
  const [ini, setIni] = useState(horaInicial || "09:00");
  // Uma hora à frente do slot clicado: é a duração padrão de um atendimento, e
  // é o bloqueio que a dona faz com mais frequência.
  const [fim, setFim] = useState(() => {
    if (!horaInicial) return "10:00";
    const h = Number(horaInicial.split(":")[0]);
    return `${String(Math.min(23, h + 1)).padStart(2, "0")}:00`;
  });
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const horaIni = diaInteiro ? null : ini;
  const horaFim = diaInteiro ? null : fim;
  const invertido = !diaInteiro && ini >= fim;

  const conflitos = useMemo(
    () => (data ? conflitosNoPeriodo(agendamentos, data, horaIni, horaFim) : []),
    [agendamentos, data, horaIni, horaFim]
  );

  async function salvar() {
    if (!data || invertido) return;
    const alvo = quem === TODAS ? ativas.map((p) => p.id) : [quem];
    if (alvo.length === 0) return;

    const linhas: NovoBloqueio[] = alvo.map((id) => ({
      profissional_id: id,
      data,
      hora_inicio: horaIni,
      hora_fim: horaFim,
      motivo: motivo.trim() || null,
    }));

    setSalvando(true);
    try {
      await criarBloqueios(linhas);
      showToast(
        alvo.length > 1 ? `Horário bloqueado para ${alvo.length}` : "Horário bloqueado",
        "success"
      );
      onSalvo();
      onClose();
    } catch {
      showToast("Não deu para bloquear o horário", "error");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) return null;

  return (
    <Modal open onClose={onClose} width={420}>
      <div className="blq-titulo">Bloquear horário</div>

      <label className="lead-label" htmlFor="blq-quem">
        Quem
      </label>
      <select
        id="blq-quem"
        className="lead-input"
        value={quem}
        onChange={(e) => {
          setQuem(e.target.value);
        }}
      >
        <option value={TODAS}>Todas ({ativas.length})</option>
        {ativas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>

      <label className="lead-label blq-espaco" htmlFor="blq-data">
        Data
      </label>
      <input
        id="blq-data"
        type="date"
        className="lead-input"
        value={data}
        onChange={(e) => {
          setData(e.target.value);
        }}
      />

      <div className="blq-espaco">
        <span className="lead-label">Período</span>
        <div className="blq-modos">
          <button
            type="button"
            className={`blq-modo${diaInteiro ? "" : " ativo"}`}
            onClick={() => {
              setDiaInteiro(false);
                }}
          >
            Faixa de horário
          </button>
          <button
            type="button"
            className={`blq-modo${diaInteiro ? " ativo" : ""}`}
            onClick={() => {
              setDiaInteiro(true);
                }}
          >
            Dia inteiro
          </button>
        </div>
      </div>

      {!diaInteiro && (
        <div className="blq-horas">
          <div>
            <label className="lead-label" htmlFor="blq-ini">
              Início
            </label>
            <input
              id="blq-ini"
              type="time"
              className="lead-input"
              value={ini}
              onChange={(e) => {
                setIni(e.target.value);
                    }}
            />
          </div>
          <div>
            <label className="lead-label" htmlFor="blq-fim">
              Fim
            </label>
            <input
              id="blq-fim"
              type="time"
              className="lead-input"
              value={fim}
              onChange={(e) => {
                setFim(e.target.value);
                    }}
            />
          </div>
        </div>
      )}
      {invertido && (
        <p className="blq-erro">O fim precisa ser depois do início.</p>
      )}

      <label className="lead-label blq-espaco" htmlFor="blq-motivo">
        Motivo <span className="blq-opcional">(opcional)</span>
      </label>
      <input
        id="blq-motivo"
        className="lead-input"
        value={motivo}
        placeholder="médico, almoço, reunião…"
        onChange={(e) => setMotivo(e.target.value)}
      />

      {conflitos.length > 0 && (
        <div className="blq-aviso" role="alert">
          <TriangleAlert size={14} strokeWidth={1.9} />
          <div>
            <strong>
              {conflitos.length === 1
                ? "Há um atendimento marcado nesse horário"
                : `Há ${conflitos.length} atendimentos marcados nesse horário`}
            </strong>
            <ul className="blq-conflitos">
              {conflitos.map((c, i) => (
                <li key={`${c.nome}-${c.hora}-${i}`}>
                  {c.hora} · {c.nome}
                </li>
              ))}
            </ul>
            {/* Nomear as clientes é o que torna a decisão possível: "há
                conflito" sozinho não diz se dá para remarcar. */}
            Bloquear <strong>não cancela</strong> nada — quem está marcado
            continua marcado.
          </div>
        </div>
      )}

      <div className="blq-acoes">
        <button
          type="button"
          className="btn-primary"
          disabled={salvando || !data || invertido}
          onClick={salvar}
        >
          {salvando
            ? "Bloqueando…"
            : conflitos.length > 0
              ? "Bloquear mesmo assim"
              : "Bloquear"}
        </button>
      </div>
    </Modal>
  );
}
