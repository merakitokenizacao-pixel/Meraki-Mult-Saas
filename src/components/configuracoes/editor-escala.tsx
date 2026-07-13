"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Eraser, Loader2, Paintbrush } from "lucide-react";
import { Modal } from "@/components/modal";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import {
  DIAS_GRADE,
  HORAS_GRADE,
  celulaKey,
  celulasParaFaixas,
  faixasParaCelulas,
  resumoDia,
  type Faixa,
} from "@/lib/escala";

type Profissional = { id: string; nome: string; cor: string };

// Editor de escala PINTÁVEL: clique e arraste na grade para marcar as horas em
// que a profissional atende. Células contíguas viram uma faixa só; um buraco
// abre outra — é assim que escala alternada e horário de almoço se representam,
// sem formulário nenhum. Ver lib/escala.ts (19 asserts na conversão).
export function EditorEscala({
  profissional,
  faixasIniciais,
  onClose,
  onSalvo,
}: {
  profissional: Profissional | null;
  faixasIniciais: Faixa[];
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [celulas, setCelulas] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  // Ao começar a arrastar decidimos o modo pela PRIMEIRA célula: se ela estava
  // apagada, o arrasto pinta; se estava pintada, apaga. (Igual a planilha.)
  const modo = useRef<"pintar" | "apagar" | null>(null);

  useEffect(() => {
    setCelulas(faixasParaCelulas(faixasIniciais));
  }, [faixasIniciais, profissional?.id]);

  // Solta o arrasto mesmo se o mouse subir fora da grade.
  useEffect(() => {
    const up = () => {
      modo.current = null;
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const faixas = useMemo(() => celulasParaFaixas(celulas), [celulas]);
  const totalHoras = celulas.size;

  function aplicar(key: string, m: "pintar" | "apagar") {
    setCelulas((prev) => {
      const has = prev.has(key);
      if ((m === "pintar" && has) || (m === "apagar" && !has)) return prev;
      const next = new Set(prev);
      if (m === "pintar") next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function onDown(key: string) {
    const m: "pintar" | "apagar" = celulas.has(key) ? "apagar" : "pintar";
    modo.current = m;
    aplicar(key, m);
  }

  function onEnter(key: string) {
    if (modo.current) aplicar(key, modo.current);
  }

  async function salvar() {
    if (!profissional) return;
    setSalvando(true);
    try {
      // Substitui a escala inteira: apaga as faixas antigas e grava as novas.
      // É mais simples (e mais seguro) que diferenciar faixa a faixa, e a
      // tabela é pequena.
      const del = await supabase
        .from("profissional_horarios")
        .delete()
        .eq("profissional_id", profissional.id);
      if (del.error) throw del.error;

      if (faixas.length > 0) {
        const ins = await supabase.from("profissional_horarios").insert(
          faixas.map((f) => ({ ...f, profissional_id: profissional.id }))
        );
        if (ins.error) throw ins.error;
      }

      showToast(`Escala de ${profissional.nome} salva`, "success");
      onSalvo();
      onClose();
    } catch (e) {
      showToast(
        "Erro ao salvar a escala: " + ((e as Error).message || "tente de novo"),
        "error"
      );
    } finally {
      setSalvando(false);
    }
  }

  if (!profissional) return null;
  const cor = profissional.cor;

  return (
    <Modal open onClose={onClose} width={720}>
      <div className="escala-head">
        <span className="prof-cor" style={{ background: cor }} />
        <div>
          <div className="escala-titulo">Escala de {profissional.nome}</div>
          <div className="escala-dica">
            <Paintbrush size={12} strokeWidth={1.8} /> Clique e arraste para
            marcar &nbsp;·&nbsp; <Eraser size={12} strokeWidth={1.8} /> arraste
            sobre o que já está marcado para apagar
          </div>
        </div>
      </div>

      {/* Grade pintável */}
      <div className="escala-grade" style={{ touchAction: "none" }}>
        <div className="escala-canto" />
        {DIAS_GRADE.map((d) => (
          <div key={d.dow} className="escala-dia-head">
            {d.label}
          </div>
        ))}

        {HORAS_GRADE.map((h) => (
          <div key={h} style={{ display: "contents" }}>
            <div className="escala-hora">
              {String(h).padStart(2, "0")}–{String(h + 1).padStart(2, "0")}
            </div>
            {DIAS_GRADE.map((d) => {
              const key = celulaKey(d.dow, h);
              const on = celulas.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${d.label} ${h}h`}
                  className={`escala-celula${on ? " on" : ""}`}
                  style={on ? { background: cor, borderColor: cor } : undefined}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    onDown(key);
                  }}
                  onPointerEnter={() => onEnter(key)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Resumo — a leitura humana do que foi pintado */}
      <div className="escala-resumo">
        {DIAS_GRADE.map((d) => (
          <div key={d.dow} className="escala-resumo-linha">
            <span className="escala-resumo-dia">{d.label}</span>
            <span className="escala-resumo-faixas">
              {resumoDia(faixas, d.dow)}
            </span>
          </div>
        ))}
      </div>

      <div className="escala-rodape">
        <span className="escala-total">
          {totalHoras === 0
            ? "Nenhuma hora marcada"
            : `${totalHoras} ${totalHoras === 1 ? "hora" : "horas"} por semana · ${faixas.length} ${faixas.length === 1 ? "faixa" : "faixas"}`}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={salvar}
            disabled={salvando}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {salvando ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Salvando…
              </>
            ) : (
              <>
                <Check size={15} strokeWidth={2} /> Salvar escala
              </>
            )}
          </button>
        </div>
      </div>

      <p className="config-nota" style={{ marginTop: 14 }}>
        A agenda calcula a capacidade de cada horário somando quantas
        profissionais estão na escala. Tirar uma hora daqui{" "}
        <strong>fecha essa vaga</strong> na agenda e para a Laura.
      </p>
    </Modal>
  );
}
