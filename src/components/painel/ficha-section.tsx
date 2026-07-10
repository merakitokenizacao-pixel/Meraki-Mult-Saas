"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import {
  alertaLabel,
  fichaStatusVisual,
  isContraindicacao,
  linhasRespostas,
  type FichaTone,
} from "@/lib/ficha";
import type { FichaRespostas, FichaStatus } from "@/types/db";

type FichaPainel = {
  id: string;
  status: FichaStatus;
  tipo: string;
  alertas: string[];
  respostas: FichaRespostas | null;
  criadoEm: string;
  dataAgendamento: string | null;
};

// Cores por severidade, via tokens da paleta (sem cor hardcoded).
const TOM: Record<FichaTone, { bg: string; fg: string; border: string }> = {
  amber: { bg: "var(--vx-amber-bg)", fg: "var(--vx-amber)", border: "var(--vx-amber)" },
  green: { bg: "var(--vx-green-bg)", fg: "var(--vx-green)", border: "var(--vx-green)" },
  red: { bg: "var(--vx-red-bg)", fg: "var(--vx-red)", border: "var(--vx-red)" },
  "red-strong": {
    bg: "var(--vx-red)",
    fg: "#fff",
    border: "var(--vx-red)",
  },
};

// Seção "Ficha do laser" no detalhe do cliente. Renderiza nada se o lead não
// tem ficha (cliente que nunca fez laser).
export function FichaSection({ leadId }: { leadId: string }) {
  const [fichas, setFichas] = useState<FichaPainel[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    setFichas(null);
    setErro(false);
    (async () => {
      try {
        const res = await fetch(`/api/painel/ficha?lead_id=${leadId}`);
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { fichas: FichaPainel[] };
        if (ativo) setFichas(json.fichas);
      } catch {
        if (ativo) setErro(true);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [leadId]);

  if (fichas === null && !erro) {
    return (
      <>
        <div className="modal-section">Ficha do laser</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", fontSize: 12, color: "var(--vx-muted)" }}>
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </div>
      </>
    );
  }
  if (erro) {
    return (
      <>
        <div className="modal-section">Ficha do laser</div>
        <div style={{ fontSize: 12, color: "var(--vx-muted)", padding: "8px 0" }}>
          Não foi possível carregar a ficha.
        </div>
      </>
    );
  }
  if (!fichas || fichas.length === 0) return null; // cliente sem ficha de laser

  return (
    <>
      <div className="modal-section">
        Ficha do laser{fichas.length > 1 ? ` (${fichas.length})` : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {fichas.map((f) => (
          <FichaCard
            key={f.id}
            ficha={f}
            onRevisada={() =>
              setFichas((prev) =>
                (prev ?? []).map((x) =>
                  x.id === f.id ? { ...x, status: "revisada" } : x
                )
              )
            }
          />
        ))}
      </div>
    </>
  );
}

function FichaCard({
  ficha,
  onRevisada,
}: {
  ficha: FichaPainel;
  onRevisada: () => void;
}) {
  const [revisando, setRevisando] = useState(false);
  const visual = fichaStatusVisual(ficha.status, ficha.alertas);
  const tom = TOM[visual.tone];

  const contraindicacoes = ficha.alertas.filter(isContraindicacao);
  const atencoes = ficha.alertas.filter((a) => !isContraindicacao(a));

  async function marcarRevisada() {
    setRevisando(true);
    try {
      const res = await fetch(`/api/painel/ficha/${ficha.id}/revisar`, {
        method: "POST",
      });
      if (res.ok) onRevisada();
    } finally {
      setRevisando(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--vx-border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Cabeçalho: badge de status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 12px",
          background: "var(--vx-surface2)",
          borderBottom: "1px solid var(--vx-border)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.02em",
            padding: "4px 10px",
            borderRadius: 999,
            background: tom.bg,
            color: tom.fg,
          }}
        >
          {visual.tone === "red-strong" && <AlertTriangle size={12} />}
          {visual.label}
        </span>
        <span style={{ fontSize: 10.5, color: "var(--vx-muted)", fontFamily: "var(--font-jetbrains)" }}>
          laser
        </span>
      </div>

      <div style={{ padding: 12 }}>
        {/* Contraindicações: destaque forte, visível sem clique */}
        {contraindicacoes.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--vx-red)",
              color: "#fff",
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, letterSpacing: "0.03em" }}>
              <AlertTriangle size={14} /> CONTRAINDICAÇÃO
            </div>
            {contraindicacoes.map((a) => (
              <div key={a} style={{ fontSize: 12.5, fontWeight: 600, paddingLeft: 20 }}>
                {alertaLabel(a)}
              </div>
            ))}
          </div>
        )}

        {/* Demais alertas */}
        {atencoes.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 10,
            }}
          >
            {atencoes.map((a) => (
              <span
                key={a}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: "var(--vx-red-bg)",
                  color: "var(--vx-red)",
                }}
              >
                {alertaLabel(a)}
              </span>
            ))}
          </div>
        )}

        {/* Respostas em pt-BR */}
        {ficha.respostas ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {linhasRespostas(ficha.respostas).map((l, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                  padding: "6px 0",
                  borderBottom:
                    i < linhasRespostas(ficha.respostas!).length - 1
                      ? "1px solid var(--vx-border)"
                      : "none",
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: "var(--vx-text2)" }}>{l.label}</span>
                <span style={{ fontWeight: 600, color: "var(--vx-text)", textAlign: "right" }}>
                  {l.valor}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--vx-muted)" }}>
            Aguardando a cliente preencher.
          </div>
        )}

        {/* Ação: marcar como revisada (só quando preenchida) */}
        {ficha.status === "preenchida" && (
          <button
            type="button"
            onClick={marcarRevisada}
            disabled={revisando}
            style={{
              marginTop: 12,
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--vx-border2)",
              background: "var(--vx-surface)",
              color: "var(--vx-text)",
              fontSize: 13,
              fontWeight: 600,
              cursor: revisando ? "default" : "pointer",
              opacity: revisando ? 0.6 : 1,
            }}
          >
            {revisando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Marcar como revisada
          </button>
        )}
        {ficha.status === "revisada" && (
          <div
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--vx-green)",
            }}
          >
            <Check size={14} /> Revisada pela equipe
          </div>
        )}
      </div>
    </div>
  );
}
