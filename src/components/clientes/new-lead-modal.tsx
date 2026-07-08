"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { insertLead } from "@/lib/queries";
import { showToast } from "@/lib/toast";

const CANAIS = ["whatsapp", "instagram", "site", "manual"];
const STATUSES = ["novo", "agendado", "convertido"];

// Normaliza o telefone para dígitos e garante o DDI 55 (formato que o n8n usa),
// pra um lead cadastrado à mão casar com o mesmo lead quando ele mandar WhatsApp.
function normalizarTelefone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

// Cadastro manual de lead (a dona da clínica cria clientes sem depender da IA).
export function NewLeadModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [canal, setCanal] = useState("whatsapp");
  const [status, setStatus] = useState("novo");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; color: string }>({
    text: "",
    color: "var(--vx-muted)",
  });

  useEffect(() => {
    if (open) {
      setNome("");
      setTelefone("");
      setCanal("whatsapp");
      setStatus("novo");
      setSaving(false);
      setMsg({ text: "", color: "var(--vx-muted)" });
    }
  }, [open]);

  async function salvar() {
    const n = nome.trim();
    const tel = normalizarTelefone(telefone);
    if (!n) {
      setMsg({ text: "Informe o nome do cliente.", color: "var(--vx-red)" });
      return;
    }
    if (tel.length < 10) {
      setMsg({ text: "Telefone inválido (com DDD).", color: "var(--vx-red)" });
      return;
    }
    setSaving(true);
    setMsg({ text: "Salvando...", color: "var(--vx-muted)" });
    try {
      await insertLead({ nome: n, telefone: tel, canal, status });
      showToast("Cliente cadastrado", "success");
      onClose();
      onCreated();
    } catch (err) {
      const code = (err as { code?: string }).code;
      setMsg({
        text:
          code === "23505"
            ? "Já existe um cliente com esse telefone."
            : "Erro ao cadastrar: " + (err as Error).message,
        color: "var(--vx-red)",
      });
      setSaving(false);
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
        Novo cliente
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label className="form-label">Nome</label>
          <input
            type="text"
            className="form-input"
            placeholder="Nome do cliente"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Telefone</label>
          <input
            type="tel"
            className="form-input"
            placeholder="(61) 98711-1144"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="form-label">Canal</label>
            <select
              className="form-input"
              value={canal}
              onChange={(e) => setCanal(e.target.value)}
            >
              {CANAIS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select
              className="form-input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          className="btn-primary"
          style={{ marginTop: 4 }}
          onClick={salvar}
          disabled={saving}
        >
          {saving ? "Salvando..." : "Cadastrar cliente"}
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
