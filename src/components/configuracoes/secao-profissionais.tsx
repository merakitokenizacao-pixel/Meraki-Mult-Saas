"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Loader2, TriangleAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Profissional = { id: string; nome: string; cor: string; ativo: boolean };
type Faixa = {
  id: string;
  profissional_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
};

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
    faixas: (h.data ?? []) as Faixa[],
  };
}

// "13:00:00" → "13h" · "13:30:00" → "13h30"
function hhmm(t: string): string {
  const [h, m] = t.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

export function SecaoProfissionais() {
  const { data, isPending, error } = useQuery({
    queryKey: ["profissionais"],
    queryFn: getProfissionais,
  });

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {profissionais.map((p) => {
        // Agrupa as faixas por dia da semana (uma pessoa pode ter várias no
        // mesmo dia — é assim que escala alternada se representa).
        const porDia = new Map<number, Faixa[]>();
        for (const f of faixas.filter((f) => f.profissional_id === p.id)) {
          const arr = porDia.get(f.dia_semana) ?? [];
          arr.push(f);
          porDia.set(f.dia_semana, arr);
        }

        return (
          <div key={p.id} className="config-card">
            <div className="prof-head">
              <span className="prof-cor" style={{ background: p.cor }} />
              <span className="prof-nome">{p.nome}</span>
              {p.ativo ? (
                <span className="badge badge-lead-cliente">ATIVA</span>
              ) : (
                <span className="badge badge-lead-inativo">INATIVA</span>
              )}
            </div>

            <div className="prof-escala">
              {DIAS.map((d, i) => {
                const doDia = porDia.get(i) ?? [];
                return (
                  <div
                    key={i}
                    className={`prof-dia${doDia.length === 0 ? " folga" : ""}`}
                  >
                    <div className="prof-dia-nome">{d}</div>
                    {doDia.length === 0 ? (
                      <div className="prof-dia-faixa vazio">—</div>
                    ) : (
                      doDia.map((f) => (
                        <div key={f.id} className="prof-dia-faixa">
                          {hhmm(f.hora_inicio)}–{hhmm(f.hora_fim)}
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="config-card" style={{ borderStyle: "dashed" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <CalendarClock size={17} strokeWidth={1.5} style={{ marginTop: 2, color: "var(--vx-accent)", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>
              Editor de escala (em construção)
            </div>
            <p style={{ fontSize: 12.5, color: "var(--vx-muted)", lineHeight: 1.55, margin: 0 }}>
              Em breve dá para <strong>pintar a grade</strong> com o mouse para
              montar a escala, sem formulário — e registrar folgas e férias.
              Por enquanto, a escala acima é a que a agenda usa para calcular a
              capacidade de cada horário.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
