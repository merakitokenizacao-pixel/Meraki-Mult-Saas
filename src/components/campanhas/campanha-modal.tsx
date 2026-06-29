"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { filtrarPublico } from "@/lib/campanha";
import {
  createCampanha,
  getLeadsParaCampanha,
  insertCampanhaEnvios,
  updateCampanhaTotal,
  type LeadParaCampanha,
} from "@/lib/queries";
import { showToast } from "@/lib/toast";

// openCampanhaModal + atualizarPublico + atualizarPreview + criarCampanha.
export function CampanhaModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [nome, setNome] = useState("");
  const [publico, setPublico] = useState("todos");
  const [msg, setMsg] = useState("");
  const [leadsCache, setLeadsCache] = useState<LeadParaCampanha[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Carrega leads frescos para a contagem (respeita opt-out atual).
  useEffect(() => {
    if (!open) return;
    setNome("");
    setPublico("todos");
    setMsg("");
    setSubmitting(false);
    setLeadsCache(null);
    getLeadsParaCampanha()
      .then(setLeadsCache)
      .catch(() => setLeadsCache([]));
  }, [open]);

  const count = useMemo(
    () => (leadsCache ? filtrarPublico(leadsCache, publico).length : null),
    [leadsCache, publico]
  );

  const preview = useMemo(() => {
    if (!msg) return "A prévia aparece aqui conforme você escreve.";
    const comNome = leadsCache?.find((l) => l.nome);
    const exemplo = comNome?.nome ? comNome.nome.split(" ")[0] : "Maria";
    return msg.replace(/\{nome\}/g, exemplo);
  }, [msg, leadsCache]);

  async function criar() {
    const n = nome.trim();
    const m = msg.trim();
    if (!n) {
      showToast("Dê um nome pra campanha.", "error");
      return;
    }
    if (!m) {
      showToast("Escreva a mensagem.", "error");
      return;
    }
    const destinatarios = filtrarPublico(leadsCache ?? [], publico);
    if (!destinatarios.length) {
      showToast("Nenhum cliente nesse público.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const camp = await createCampanha({
        nome: n,
        mensagem: m,
        publico,
        status: "enviando",
        total: destinatarios.length,
        enviados: 0,
      });

      const envios = destinatarios.map((l) => ({
        campanha_id: camp.id,
        lead_id: l.id,
        telefone: l.telefone,
        nome: l.nome || null,
        status: "pendente",
      }));

      let inseridos = 0;
      let falhou = false;
      for (let i = 0; i < envios.length; i += 500) {
        const lote = envios.slice(i, i + 500);
        try {
          await insertCampanhaEnvios(lote);
          inseridos += lote.length;
        } catch {
          falhou = true;
          break;
        }
      }

      if (inseridos !== destinatarios.length) {
        await updateCampanhaTotal(camp.id, inseridos);
      }
      if (falhou) {
        showToast(
          "Campanha criada, mas parte da fila falhou (" + inseridos + " ok).",
          "error"
        );
      } else {
        showToast(
          inseridos + " clientes na fila. O envio sai aos poucos.",
          "success"
        );
      }
      onClose();
      onCreated();
    } catch {
      showToast("Erro ao criar campanha.", "error");
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div
        style={{
          fontFamily: "var(--font-cormorant), serif",
          fontSize: 25,
          fontWeight: 400,
          marginBottom: "1.5rem",
        }}
      >
        Nova campanha
      </div>

      <div style={{ marginBottom: "1.1rem" }}>
        <label className="form-label">Nome da campanha</label>
        <input
          type="text"
          className="form-input"
          placeholder="Ex.: Reativação de junho"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: "1.1rem" }}>
        <label className="form-label">Público</label>
        <select
          className="form-input"
          value={publico}
          onChange={(e) => setPublico(e.target.value)}
        >
          <option value="todos">Todos os clientes</option>
          <option value="inativos_30">Inativos há mais de 30 dias</option>
          <option value="inativos_60">Inativos há mais de 60 dias</option>
        </select>
      </div>

      <div className="camp-count-box">
        <div>
          <div className="camp-count-num">{count ?? "…"}</div>
          <div className="camp-count-label">clientes vão receber</div>
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--vx-muted)",
            textAlign: "right",
            maxWidth: 150,
            lineHeight: 1.4,
          }}
        >
          quem pediu pra sair não entra
        </div>
      </div>

      <div style={{ margin: "1.25rem 0 1.1rem" }}>
        <label className="form-label">Mensagem</label>
        <textarea
          className="form-input"
          placeholder="Escreva a mensagem da campanha..."
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
        />
        <div className="camp-note">
          Use <b>{"{nome}"}</b> na mensagem e a gente troca pelo primeiro nome de
          cada paciente.
        </div>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <label className="form-label">Prévia</label>
        <div className="camp-preview">{preview}</div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button
          className="filter-btn"
          style={{ padding: "9px 20px" }}
          onClick={onClose}
        >
          Cancelar
        </button>
        <button className="btn-primary" onClick={criar} disabled={submitting}>
          {submitting ? "Enfileirando..." : "Criar e enfileirar"}
        </button>
      </div>
    </Modal>
  );
}
