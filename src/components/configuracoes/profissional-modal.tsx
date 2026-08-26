"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/modal";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";

// Cores da paleta da marca — distinguíveis entre si e legíveis nos dois temas.
const CORES = [
  "#9b7d5a", // dourado (accent)
  "#3a6b4f", // verde
  "#2a5278", // azul
  "#5c4fa0", // roxo
  "#b5600a", // âmbar
  "#a3342a", // vermelho terroso
  "#4a7c7e", // petróleo
  "#7a5c8a", // ameixa
];

export type ProfissionalEdit = {
  id: string;
  nome: string;
  cor: string;
} | null;

export function ProfissionalModal({
  aberto,
  profissional, // null = criar nova
  onClose,
  onSalvo,
}: {
  aberto: boolean;
  profissional: ProfissionalEdit;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const editando = Boolean(profissional);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setNome(profissional?.nome ?? "");
    setCor(profissional?.cor ?? CORES[0]);
    setErro(null);
    setConfirmandoExclusao(false);
  }, [aberto, profissional]);

  async function salvar() {
    const n = nome.trim();
    if (n.length < 2) {
      setErro("Informe o nome da profissional.");
      return;
    }
    setSalvando(true);
    setErro(null);

    const res = editando
      ? await supabase
          .from("profissionais")
          .update({ nome: n, cor })
          .eq("id", profissional!.id)
      : await supabase.from("profissionais").insert({ nome: n, cor, ativo: true });

    setSalvando(false);

    if (res.error) {
      // `nome` é único — evita duas "Ana" que ninguém distingue na agenda.
      setErro(
        res.error.code === "23505"
          ? "Já existe uma profissional com esse nome."
          : "Não foi possível salvar."
      );
      return;
    }

    showToast(
      editando ? "Profissional atualizada" : `${n} cadastrada — agora monte a escala dela`,
      "success"
    );
    onSalvo();
    onClose();
  }

  async function excluir() {
    if (!profissional) return;
    setSalvando(true);

    // Trava: se ela já atendeu (ou está atribuída a algum agendamento), apagar
    // quebraria o histórico. Nesse caso o caminho é DESATIVAR — a escala dela
    // sai da agenda mas o passado continua de pé.
    const { count, error: errCount } = await supabase
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("profissional_id", profissional.id);

    if (errCount) {
      setSalvando(false);
      setErro("Não foi possível verificar os agendamentos dela.");
      return;
    }

    if ((count ?? 0) > 0) {
      setSalvando(false);
      setErro(
        `${profissional.nome} está ligada a ${count} agendamento(s). Em vez de excluir, desative — assim o histórico não se perde.`
      );
      setConfirmandoExclusao(false);
      return;
    }

    // A escala e as folgas dela caem junto (ON DELETE CASCADE).
    const { error } = await supabase
      .from("profissionais")
      .delete()
      .eq("id", profissional.id);

    setSalvando(false);

    if (error) {
      setErro("Não foi possível excluir.");
      return;
    }
    showToast(`${profissional.nome} removida`, "info");
    onSalvo();
    onClose();
  }

  if (!aberto) return null;

  return (
    <Modal open onClose={onClose} width={460}>
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          marginBottom: "1rem",
        }}
      >
        {editando ? "Editar profissional" : "Nova profissional"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label className="form-label">Nome</label>
          <input
            type="text"
            className="form-input"
            value={nome}
            autoFocus
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como ela aparece na agenda"
          />
        </div>

        <div>
          <label className="form-label">Cor na agenda</label>
          <div className="cor-grid">
            {CORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                className={`cor-opcao${cor === c ? " active" : ""}`}
                style={{ background: c }}
                aria-label={`Cor ${c}`}
                aria-pressed={cor === c}
              >
                {cor === c && <Check size={14} strokeWidth={3} color="#fff" />}
              </button>
            ))}
          </div>
        </div>

        {erro && (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--mk-red-bg)",
              color: "var(--mk-red)",
              fontSize: 12.5,
              lineHeight: 1.45,
            }}
          >
            <TriangleAlert size={15} strokeWidth={1.8} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>{erro}</span>
          </div>
        )}

        <button
          className="btn-primary"
          onClick={salvar}
          disabled={salvando}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}
        >
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={2} />}
          {editando ? "Salvar" : "Cadastrar"}
        </button>

        {!editando && (
          <p className="config-nota" style={{ marginTop: 0 }}>
            Depois de cadastrar, <strong>monte a escala dela</strong> — enquanto
            não houver horário pintado, ela não entra na capacidade da agenda.
          </p>
        )}

        {editando && (
          <div style={{ paddingTop: 12, borderTop: "1px solid var(--mk-border)" }}>
            {!confirmandoExclusao ? (
              <button
                className="btn-ghost"
                onClick={() => setConfirmandoExclusao(true)}
                disabled={salvando}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--mk-red)",
                  borderColor: "var(--mk-red)",
                }}
              >
                <Trash2 size={14} strokeWidth={1.8} /> Excluir profissional
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 12.5, color: "var(--mk-text2)", lineHeight: 1.5, margin: 0 }}>
                  Isso apaga <strong>a escala e as folgas</strong> de{" "}
                  {profissional?.nome}. Não dá pra desfazer.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-ghost" onClick={() => setConfirmandoExclusao(false)} disabled={salvando}>
                    Cancelar
                  </button>
                  <button
                    className="btn-primary"
                    onClick={excluir}
                    disabled={salvando}
                    style={{ background: "var(--mk-red)", display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    {salvando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Excluir mesmo assim
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
