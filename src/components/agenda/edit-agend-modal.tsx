"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { Avatar } from "@/components/avatar";
import { StatusBadge } from "@/components/status-badge";
import { formatTelefone, limparServico } from "@/lib/format";
import { deleteAgendamento, updateAgendamentoStatus } from "@/lib/queries";
import { showToast } from "@/lib/toast";
import type { AgendamentoComLead } from "@/types/db";

const STATUSES = ["pendente", "confirmado", "realizado", "cancelado"];

// openEditAgendamento / updateAgendStatus / excluirAgendamento.
export function EditAgendModal({
  agend,
  allAgendamentos,
  onClose,
  onChanged,
}: {
  agend: AgendamentoComLead | null;
  allAgendamentos: AgendamentoComLead[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [statusMsg, setStatusMsg] = useState<{ text: string; color: string }>({
    text: "",
    color: "var(--vx-green)",
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (agend) {
      setStatusMsg({ text: "", color: "var(--vx-green)" });
      setConfirmDelete(false);
    }
  }, [agend]);

  if (!agend) return null;

  const lead = agend.leads;
  const dt = agend.data_agendamento ? new Date(agend.data_agendamento) : null;
  const visitas = allAgendamentos.filter(
    (x) => x.lead_id === agend.lead_id && x.status === "realizado"
  ).length;
  const totalAgend = allAgendamentos.filter(
    (x) => x.lead_id === agend.lead_id
  ).length;

  async function updateStatus(status: string) {
    try {
      await updateAgendamentoStatus(agend!.id, status);
      setStatusMsg({ text: "Status atualizado!", color: "var(--vx-green)" });
      showToast("Status atualizado", "success");
      setTimeout(() => {
        onClose();
        onChanged();
      }, 800);
    } catch (err) {
      setStatusMsg({
        text: "Erro: " + (err as Error).message,
        color: "var(--vx-red)",
      });
    }
  }

  async function excluir() {
    try {
      await deleteAgendamento(agend!.id);
      onClose();
      showToast("Agendamento excluido", "info");
      onChanged();
    } catch (err) {
      showToast("Erro: " + (err as Error).message, "error");
    }
  }

  const box: React.CSSProperties = {
    background: "var(--vx-surface2)",
    borderRadius: 10,
    padding: 12,
  };
  const boxLabel: React.CSSProperties = {
    fontSize: 10,
    color: "var(--vx-muted)",
    fontWeight: 700,
    marginBottom: 4,
  };

  return (
    <Modal open={!!agend} onClose={onClose}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: "1.25rem",
        }}
      >
        <Avatar
          nome={lead?.nome}
          fotoUrl={lead?.foto_url}
          size={48}
          fontSize={15}
          style={{ border: "2px solid var(--vx-border)" }}
        />
        <div style={{ flex: 1 }}>
          <div className="modal-name">{lead?.nome || "—"}</div>
          <div className="modal-phone">
            {lead?.telefone ? formatTelefone(lead.telefone) : "—"}
          </div>
        </div>
        <StatusBadge status={agend.status} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginBottom: "1rem",
        }}
      >
        <div style={box}>
          <div style={boxLabel}>SERVICO</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--vx-accent)" }}>
            {limparServico(agend.servico)}
          </div>
        </div>
        <div style={box}>
          <div style={boxLabel}>DATA</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {dt
              ? dt.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "—"}
          </div>
        </div>
        <div style={box}>
          <div style={boxLabel}>HORARIO</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {dt
              ? dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
              : "—"}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: "1rem",
        }}
      >
        <div style={{ ...box, background: "var(--vx-green-bg)" }}>
          <div style={boxLabel}>VISITAS</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--vx-green)" }}>
            {visitas}
          </div>
        </div>
        <div style={box}>
          <div style={boxLabel}>TOTAL AGEND.</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{totalAgend}</div>
        </div>
      </div>

      <div className="modal-section">Atualizar status</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {STATUSES.map((s) => (
          <button
            key={s}
            className={`filter-btn${agend.status === s ? " active" : ""}`}
            onClick={() => updateStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div
        style={{
          fontSize: 12,
          marginTop: 10,
          minHeight: 16,
          color: statusMsg.color,
        }}
      >
        {statusMsg.text}
      </div>

      <div style={{ borderTop: "1px solid var(--vx-border)", margin: "1rem 0" }} />
      {!confirmDelete ? (
        <button
          onClick={() => setConfirmDelete(true)}
          style={{
            width: "100%",
            background: "var(--vx-red-bg)",
            border: "1px solid var(--vx-red)",
            color: "var(--vx-red)",
            padding: 10,
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "var(--font-inter), sans-serif",
          }}
        >
          Excluir agendamento
        </button>
      ) : (
        <div
          style={{
            marginTop: 0,
            background: "var(--vx-surface2)",
            borderRadius: 10,
            padding: 14,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 13, marginBottom: 10 }}>Tem certeza?</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                background: "var(--vx-surface)",
                border: "1px solid var(--vx-border)",
                color: "var(--vx-muted)",
                padding: "8px 16px",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "var(--font-inter), sans-serif",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={excluir}
              style={{
                background: "var(--vx-red)",
                border: "none",
                color: "#fff",
                padding: "8px 16px",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "var(--font-inter), sans-serif",
                fontWeight: 600,
              }}
            >
              Excluir
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
