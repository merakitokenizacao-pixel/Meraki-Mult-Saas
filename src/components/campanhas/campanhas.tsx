"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCampanhas } from "@/lib/hooks";
import { campBadge, publicoLabel } from "@/lib/campanha";
import { fmtDate } from "@/lib/format";
import { CampanhaModal } from "@/components/campanhas/campanha-modal";

export function Campanhas() {
  const qc = useQueryClient();
  const campanhasQuery = useCampanhas();
  const campanhas = campanhasQuery.data ?? [];
  const [modalOpen, setModalOpen] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["campanhas"] });

  return (
    <div className="page-fade">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: "var(--vx-muted)",
            maxWidth: 540,
            lineHeight: 1.5,
          }}
        >
          Envie mensagens para grupos de pacientes pelo WhatsApp. O envio sai aos
          poucos, de forma natural, pra proteger o número da clínica.
        </div>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          + Nova campanha
        </button>
      </div>

      <div className="card" style={{ padding: "0.5rem" }}>
        {campanhasQuery.isPending ? (
          <div className="loading">
            <div className="spinner" /> Carregando...
          </div>
        ) : campanhasQuery.isError ? (
          <div className="camp-empty">Erro ao carregar campanhas.</div>
        ) : campanhas.length === 0 ? (
          <div className="camp-empty">
            Nenhuma campanha criada ainda.
            <br />
            Clique em &quot;Nova campanha&quot; para começar.
          </div>
        ) : (
          <div className="camp-list">
            {campanhas.map((c) => {
              const total = c.total || 0;
              const env = c.enviados || 0;
              const pct = total > 0 ? Math.round((env / total) * 100) : 0;
              const badge = campBadge(c.status);
              return (
                <div className="camp-row" key={c.id}>
                  <div className="camp-main">
                    <div className="camp-name">{c.nome || "Campanha"}</div>
                    <div className="camp-meta">
                      <span className={`badge ${badge.cls}`}>{badge.label}</span>
                      <span>{publicoLabel(c.publico)}</span>
                      <span>{fmtDate(c.criado_em)}</span>
                    </div>
                  </div>
                  <div className="camp-progress-wrap">
                    <div className="camp-progress-track">
                      <div
                        className="camp-progress-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="camp-progress-label">
                      {env} / {total} enviados
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CampanhaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={refresh}
      />
    </div>
  );
}
