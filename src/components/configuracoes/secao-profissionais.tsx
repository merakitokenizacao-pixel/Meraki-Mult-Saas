"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, TriangleAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import { EditorEscala } from "@/components/configuracoes/editor-escala";
import { DIAS_GRADE, resumoDia, type Faixa } from "@/lib/escala";

type Profissional = { id: string; nome: string; cor: string; ativo: boolean };
type FaixaRow = Faixa & { id: string; profissional_id: string };

async function getProfissionais() {
  const [p, h] = await Promise.all([
    supabase.from("profissionais").select("id,nome,cor,ativo").order("nome"),
    supabase
      .from("profissional_horarios")
      .select("id,profissional_id,dia_semana,hora_inicio,hora_fim")
      .order("dia_semana")
      .order("hora_inicio"),
  ]);
  if (p.error) throw p.error;
  if (h.error) throw h.error;
  return {
    profissionais: (p.data ?? []) as Profissional[],
    faixas: (h.data ?? []) as FaixaRow[],
  };
}

export function SecaoProfissionais() {
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ["profissionais"],
    queryFn: getProfissionais,
  });
  const [editando, setEditando] = useState<Profissional | null>(null);

  const recarregar = () => qc.invalidateQueries({ queryKey: ["profissionais"] });

  async function alternarAtivo(p: Profissional) {
    const { error } = await supabase
      .from("profissionais")
      .update({ ativo: !p.ativo })
      .eq("id", p.id);
    if (error) {
      showToast("Não foi possível alterar.", "error");
      return;
    }
    showToast(
      p.ativo
        ? `${p.nome} desativada — os horários dela saem da agenda`
        : `${p.nome} reativada`,
      "info"
    );
    recarregar();
  }

  if (isPending) {
    return (
      <div className="config-card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--vx-muted)", fontSize: 13 }}>
          <Loader2 size={15} className="animate-spin" /> Carregando…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="config-card">
        <div style={{ display: "flex", gap: 9, alignItems: "flex-start", color: "var(--vx-red)", fontSize: 13 }}>
          <TriangleAlert size={16} strokeWidth={1.8} style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>
              Não foi possível carregar as profissionais.
            </div>
            <div style={{ color: "var(--vx-muted)", fontSize: 12.5 }}>
              As permissões de leitura ainda não foram liberadas no banco.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { profissionais, faixas } = data;
  const faixasDe = (id: string) => faixas.filter((f) => f.profissional_id === id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {profissionais.map((p) => {
        const minhas = faixasDe(p.id);
        return (
          <div key={p.id} className="config-card">
            <div className="prof-head">
              <span className="prof-cor" style={{ background: p.cor }} />
              <span className="prof-nome">{p.nome}</span>
              <span className={`badge badge-lead-${p.ativo ? "cliente" : "inativo"}`}>
                {p.ativo ? "ATIVA" : "INATIVA"}
              </span>

              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={() => alternarAtivo(p)}>
                  {p.ativo ? "Desativar" : "Reativar"}
                </button>
                <button
                  className="btn-primary"
                  onClick={() => setEditando(p)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <CalendarClock size={14} strokeWidth={1.8} /> Editar escala
                </button>
              </div>
            </div>

            <div className="prof-escala">
              {DIAS_GRADE.map((d) => {
                const texto = resumoDia(minhas, d.dow);
                const folga = texto === "—";
                return (
                  <div key={d.dow} className={`prof-dia${folga ? " folga" : ""}`}>
                    <div className="prof-dia-nome">{d.label}</div>
                    {folga ? (
                      <div className="prof-dia-faixa vazio">—</div>
                    ) : (
                      texto.split(" · ").map((t) => (
                        <div key={t} className="prof-dia-faixa">
                          {t}
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>

            {!p.ativo && (
              <p className="config-nota">
                Desativada: a escala dela <strong>não conta</strong> na
                capacidade da agenda, mas fica guardada para quando voltar.
              </p>
            )}
          </div>
        );
      })}

      <EditorEscala
        profissional={editando}
        faixasIniciais={editando ? faixasDe(editando.id) : []}
        onClose={() => setEditando(null)}
        onSalvo={recarregar}
      />
    </div>
  );
}
