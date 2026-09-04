"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import { rotuloHora } from "@/lib/escala";

type Profissional = { id: string; nome: string; cor: string };
type Bloqueio = {
  id: string;
  profissional_id: string;
  data: string; // "2026-07-20"
  hora_inicio: string | null;
  hora_fim: string | null;
  motivo: string | null;
};

async function getBloqueios(): Promise<Bloqueio[]> {
  const { data, error } = await supabase
    .from("profissional_bloqueios")
    .select("id,profissional_id,data,hora_inicio,hora_fim,motivo")
    .gte("data", new Date().toISOString().split("T")[0]) // só os que ainda valem
    .order("data");
  if (error) throw error;
  return (data ?? []) as Bloqueio[];
}

function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

// Folgas, férias, médico: tira a profissional da escala em UMA data (ou num
// pedaço dela). A capacidade da agenda cai sozinha — é a função `agenda_checar`
// que desconta os bloqueios, então isso vale para o CRM E para a agente.
export function Bloqueios({ profissionais }: { profissionais: Profissional[] }) {
  const qc = useQueryClient();
  const { data: bloqueios, isPending } = useQuery({
    queryKey: ["profissional-bloqueios"],
    queryFn: getBloqueios,
  });

  const [abrindo, setAbrindo] = useState(false);
  const [profId, setProfId] = useState("");
  const [data, setData] = useState("");
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [ini, setIni] = useState("13:00");
  const [fim, setFim] = useState("18:00");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["profissional-bloqueios"] });
    // A grade da agenda muda junto: a capacidade daquele dia cai.
    qc.invalidateQueries({ queryKey: ["agendamentos"] });
  };

  function limpar() {
    setProfId("");
    setData("");
    setDiaInteiro(true);
    setIni("13:00");
    setFim("18:00");
    setMotivo("");
    setAbrindo(false);
  }

  async function salvar() {
    if (!profId || !data) {
      showToast("Escolha a profissional e a data.", "error");
      return;
    }
    if (!diaInteiro && ini >= fim) {
      showToast("O horário final tem que ser depois do inicial.", "error");
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from("profissional_bloqueios").insert({
      profissional_id: profId,
      data,
      hora_inicio: diaInteiro ? null : ini + ":00",
      hora_fim: diaInteiro ? null : fim + ":00",
      motivo: motivo.trim() || null,
    });
    setSalvando(false);

    if (error) {
      showToast("Não foi possível salvar.", "error");
      return;
    }
    showToast("Folga registrada — a agenda já não oferece esse horário", "success");
    limpar();
    recarregar();
  }

  async function remover(b: Bloqueio) {
    const { error } = await supabase
      .from("profissional_bloqueios")
      .delete()
      .eq("id", b.id);
    if (error) {
      showToast("Não foi possível remover.", "error");
      return;
    }
    showToast("Folga removida — o horário volta a ficar disponível", "info");
    recarregar();
  }

  const nomeDe = (id: string) =>
    profissionais.find((p) => p.id === id)?.nome ?? "—";
  const corDe = (id: string) =>
    profissionais.find((p) => p.id === id)?.cor ?? "var(--mk-tinta-fraca)";

  return (
    <div className="config-card">
      <div className="prof-head" style={{ marginBottom: 12 }}>
        <CalendarOff size={16} strokeWidth={1.6} style={{ color: "var(--mk-acento)" }} />
        <span className="prof-nome">Folgas e férias</span>
        {!abrindo && (
          <button
            className="btn-primary"
            style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={() => setAbrindo(true)}
          >
            <Plus size={14} strokeWidth={2} /> Adicionar
          </button>
        )}
      </div>

      {abrindo && (
        <div className="bloqueio-form">
          <div className="config-grid-2">
            <div>
              <label className="form-label">Profissional</label>
              <select
                className="form-input"
                value={profId}
                onChange={(e) => setProfId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {profissionais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Data</label>
              <input
                type="date"
                className="form-input"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
          </div>

          <label className="bloqueio-check">
            <input
              type="checkbox"
              checked={diaInteiro}
              onChange={(e) => setDiaInteiro(e.target.checked)}
            />
            <span>Dia inteiro</span>
          </label>

          {!diaInteiro && (
            <div className="config-grid-2">
              <div>
                <label className="form-label">Das</label>
                <input
                  type="time"
                  className="form-input"
                  value={ini}
                  onChange={(e) => setIni(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Até</label>
                <input
                  type="time"
                  className="form-input"
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label className="form-label">Motivo (opcional)</label>
            <input
              type="text"
              className="form-input"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Férias, médico, folga…"
            />
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn-ghost" onClick={limpar} disabled={salvando}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={salvar}
              disabled={salvando}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {salvando ? <Loader2 size={14} className="animate-spin" /> : null}
              Salvar folga
            </button>
          </div>
        </div>
      )}

      {isPending ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--mk-tinta-fraca)", fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </div>
      ) : (bloqueios ?? []).length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--mk-tinta-fraca)", margin: 0 }}>
          Nenhuma folga marcada. A escala semanal vale para todos os dias.
        </p>
      ) : (
        <div className="bloqueio-lista">
          {(bloqueios ?? []).map((b) => (
            <div key={b.id} className="bloqueio-item">
              <span className="prof-cor" style={{ background: corDe(b.profissional_id) }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="bloqueio-quando">
                  <strong>{nomeDe(b.profissional_id)}</strong> · {dataBR(b.data)}
                  {b.hora_inicio && b.hora_fim ? (
                    <span className="bloqueio-faixa">
                      {rotuloHora(b.hora_inicio)}–{rotuloHora(b.hora_fim)}
                    </span>
                  ) : (
                    <span className="bloqueio-faixa">dia inteiro</span>
                  )}
                </div>
                {b.motivo && <div className="bloqueio-motivo">{b.motivo}</div>}
              </div>
              <button
                className="bloqueio-remover"
                onClick={() => remover(b)}
                title="Remover folga"
                aria-label={`Remover folga de ${nomeDe(b.profissional_id)}`}
              >
                <Trash2 size={14} strokeWidth={1.6} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="config-nota">
        A folga tira a profissional da escala <strong>naquela data</strong>. A
        capacidade da agenda cai sozinha — e a agente também para de oferecer o
        horário, porque ela consulta a mesma fonte.
      </p>
    </div>
  );
}
