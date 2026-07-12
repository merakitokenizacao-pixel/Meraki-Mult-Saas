"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { LeadCombobox } from "@/components/lead-combobox";
import { insertAgendamento } from "@/lib/queries";
import { showToast } from "@/lib/toast";
import { podeAgendar } from "@/lib/agenda-regras";
import type { AgendamentoComLead, Lead } from "@/types/db";

const SERVICOS = [
  "Limpeza de pele",
  "Botox",
  "Peeling",
  "Drenagem linfatica",
  "Preenchimento",
  "Microagulhamento",
  "Depilacao a laser",
  "Outro",
];

// quickAgendamento / openNewAgendamento / salvarAgendamento.
export function NewAgendModal({
  open,
  onClose,
  leads,
  agendamentos,
  prefill,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  leads: Lead[];
  agendamentos: AgendamentoComLead[];
  prefill: { data: string; hora: string };
  onCreated: () => void;
}) {
  const [leadId, setLeadId] = useState("");
  const [servico, setServico] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [status, setStatus] = useState("pendente");
  const [msg, setMsg] = useState<{ text: string; color: string }>({
    text: "",
    color: "var(--vx-muted)",
  });

  // Aplica o prefill (data/hora) e zera o formulário ao abrir.
  useEffect(() => {
    if (open) {
      setLeadId("");
      setServico("");
      setStatus("pendente");
      setData(prefill.data);
      setHora(prefill.hora);
      setMsg({ text: "", color: "var(--vx-muted)" });
    }
  }, [open, prefill.data, prefill.hora]);

  // Checagem de capacidade ao vivo: reage a data/hora escolhidas e avisa ANTES
  // de a pessoa tentar salvar. Regras em lib/agenda-regras.ts.
  const checagem = useMemo(
    () => (data && hora ? podeAgendar(agendamentos, data, hora) : null),
    [agendamentos, data, hora]
  );
  const bloqueado = checagem !== null && !checagem.ok;

  async function salvar() {
    if (!leadId || !servico || !data || !hora) {
      setMsg({ text: "Preencha todos os campos!", color: "var(--vx-red)" });
      return;
    }
    // Revalida no submit: o horário pode ter lotado enquanto o modal estava
    // aberto (outra pessoa marcando, ou a Laura pelo WhatsApp).
    const check = podeAgendar(agendamentos, data, hora);
    if (!check.ok) {
      setMsg({ text: check.motivo ?? "Horário indisponível.", color: "var(--vx-red)" });
      return;
    }
    setMsg({ text: "Salvando...", color: "var(--vx-muted)" });
    try {
      await insertAgendamento({
        lead_id: leadId,
        servico,
        data_agendamento: data + "T" + hora + ":00",
        status,
      });
      // NÃO escrever leads.status aqui. "Tem horário marcado" é DERIVADO de
      // `agendamentos` (ver coluna "Próxima visita"), não é ciclo de vida.
      // O writer antigo (`status: "agendado"`) rebaixava um `cliente` de volta
      // para `agendado` toda vez que ele marcava uma nova sessão — foi o que
      // aconteceu com um cliente real de 5 procedimentos. Quem promove o lead
      // é o TRIGGER do banco, quando um agendamento vira 'realizado'.
      setMsg({ text: "Agendamento salvo!", color: "var(--vx-green)" });
      showToast("Agendamento criado com sucesso", "success");
      setTimeout(() => {
        onClose();
        onCreated();
      }, 1000);
    } catch (err) {
      setMsg({ text: "Erro: " + (err as Error).message, color: "var(--vx-red)" });
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={460}>
      <div
        style={{
          fontFamily: "var(--font-cormorant), serif",
          fontSize: 22,
          fontWeight: 300,
          marginBottom: "1.25rem",
          letterSpacing: "0.02em",
        }}
      >
        Novo agendamento
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label className="form-label">Cliente</label>
          <LeadCombobox leads={leads} value={leadId} onChange={setLeadId} />
        </div>
        <div>
          <label className="form-label">Servico</label>
          <select
            className="form-input"
            value={servico}
            onChange={(e) => setServico(e.target.value)}
          >
            <option value="">Selecione o servico...</option>
            {SERVICOS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="form-label">Data</label>
            <input
              type="date"
              className="form-input"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Horario</label>
            <input
              type="time"
              className="form-input"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="form-label">Status</label>
          <select
            className="form-input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="pendente">Pendente</option>
            <option value="confirmado">Confirmado</option>
          </select>
        </div>
        {/* Aviso de capacidade: por que esse horário não pode receber marcação */}
        {bloqueado && (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--vx-red-bg)",
              color: "var(--vx-red)",
              fontSize: 12.5,
              lineHeight: 1.4,
            }}
          >
            <span aria-hidden>⚠</span>
            <span>{checagem?.motivo}</span>
          </div>
        )}
        {!bloqueado && checagem?.ok && (
          <div
            style={{
              fontSize: 12,
              color: "var(--vx-green)",
              textAlign: "center",
            }}
          >
            Horário disponível
          </div>
        )}

        <button
          className="btn-primary"
          style={{
            marginTop: 4,
            opacity: bloqueado ? 0.5 : 1,
            cursor: bloqueado ? "not-allowed" : "pointer",
          }}
          disabled={bloqueado}
          onClick={salvar}
        >
          Salvar agendamento
        </button>
        <div
          style={{
            fontSize: 12,
            textAlign: "center",
            minHeight: 16,
            color: msg.color,
          }}
        >
          {msg.text}
        </div>
      </div>
    </Modal>
  );
}
