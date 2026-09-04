"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { LeadCombobox } from "@/components/lead-combobox";
import { ServicoCombobox } from "@/components/servico-combobox";
import { useCatalogoServicos } from "@/lib/hooks";
import { checarHorario, insertAgendamento } from "@/lib/queries";
import { showToast } from "@/lib/toast";
import type { Lead } from "@/types/db";


// quickAgendamento / openNewAgendamento / salvarAgendamento.
export function NewAgendModal({
  open,
  onClose,
  leads,
  leadsLoading = false,
  prefill,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  leads: Lead[];
  /** A lista só é buscada quando o modal abre — pode chegar um instante depois. */
  leadsLoading?: boolean;
  prefill: { data: string; hora: string };
  onCreated: () => void;
}) {
  const [leadId, setLeadId] = useState("");
  const [servico, setServico] = useState("");
  // Só busca quando o modal abre — é catálogo, não muda no meio do dia.
  const catalogo = useCatalogoServicos();
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [status, setStatus] = useState("pendente");
  const [msg, setMsg] = useState<{ text: string; color: string }>({
    text: "",
    color: "var(--mk-tinta-fraca)",
  });

  // Aplica o prefill (data/hora) e zera o formulário ao abrir.
  useEffect(() => {
    if (open) {
      setLeadId("");
      setServico("");
      setStatus("pendente");
      setData(prefill.data);
      setHora(prefill.hora);
      setMsg({ text: "", color: "var(--mk-tinta-fraca)" });
    }
  }, [open, prefill.data, prefill.hora]);

  // Checagem de capacidade ao vivo, feita PELO BANCO (`agenda_checar`) — a
  // mesma função que a agente vai consultar e que o trigger usa. Não existe
  // mais uma cópia das regras no cliente: capacidade vem da escala das
  // profissionais (Configurações → Profissionais).
  const [checagem, setChecagem] = useState<{ ok: boolean; motivo: string } | null>(
    null
  );
  const [checando, setChecando] = useState(false);

  useEffect(() => {
    if (!open || !data || !hora) {
      setChecagem(null);
      return;
    }
    let ativo = true;
    setChecando(true);
    checarHorario(`${data}T${hora}:00`)
      .then((r) => {
        if (ativo) setChecagem({ ok: r.ok, motivo: r.motivo });
      })
      .catch(() => {
        if (ativo) setChecagem(null); // erro de rede: não trava o salvar
      })
      .finally(() => {
        if (ativo) setChecando(false);
      });
    return () => {
      ativo = false;
    };
  }, [open, data, hora]);

  const bloqueado = checagem !== null && !checagem.ok;

  async function salvar() {
    if (!leadId || !servico || !data || !hora) {
      setMsg({ text: "Preencha todos os campos!", color: "var(--mk-alerta)" });
      return;
    }
    // Revalida no submit: o horário pode ter lotado com o modal aberto (outra
    // pessoa marcando, ou a agente pelo WhatsApp).
    setMsg({ text: "Conferindo o horário...", color: "var(--mk-tinta-fraca)" });
    const check = await checarHorario(`${data}T${hora}:00`);
    if (!check.ok) {
      setMsg({ text: check.motivo, color: "var(--mk-alerta)" });
      setChecagem({ ok: false, motivo: check.motivo });
      return;
    }
    setMsg({ text: "Salvando...", color: "var(--mk-tinta-fraca)" });
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
      setMsg({ text: "Agendamento salvo!", color: "var(--mk-ativa)" });
      showToast("Agendamento criado com sucesso", "success");
      setTimeout(() => {
        onClose();
        onCreated();
      }, 1000);
    } catch (err) {
      setMsg({ text: "Erro: " + (err as Error).message, color: "var(--mk-alerta)" });
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={460}>
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          marginBottom: "1rem",
        }}
      >
        Novo agendamento
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label className="form-label">Cliente</label>
          {leadsLoading && leads.length === 0 ? (
            <div
              className="form-input"
              style={{ color: "var(--mk-tinta-fraca)", fontSize: 12 }}
            >
              Carregando clientes…
            </div>
          ) : (
            <LeadCombobox leads={leads} value={leadId} onChange={setLeadId} />
          )}
        </div>
        <div>
          <label className="form-label">Servico</label>
          {/* Era um <select> com 10 nomes fixos no código, que não cobria
              metade do que a clínica faz — o resto virava "Outro", sem preço.
              Agora vem de `documentos`, o mesmo catálogo que a agente lê,
              com busca por nome, categoria e sinônimo. */}
          <ServicoCombobox
            servicos={catalogo.data?.servicos ?? []}
            value={servico}
            onChange={setServico}
            carregando={catalogo.isPending}
          />
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
              background: "var(--mk-alerta-fraca)",
              color: "var(--mk-alerta)",
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
              color: "var(--mk-ativa)",
              textAlign: "center",
            }}
          >
            Horário disponível
          </div>
        )}
        {checando && (
          <div
            style={{ fontSize: 12, color: "var(--mk-tinta-fraca)", textAlign: "center" }}
          >
            Conferindo disponibilidade…
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
