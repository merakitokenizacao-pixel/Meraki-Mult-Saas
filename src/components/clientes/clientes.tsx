"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { filterByDate } from "@/lib/date";
import { useLeads } from "@/lib/hooks";
import { LeadsTable } from "@/components/clientes/leads-table";
import { LeadModal } from "@/components/clientes/lead-modal";
import { NewLeadModal } from "@/components/clientes/new-lead-modal";
import type { Lead } from "@/types/db";

const PERIODS: ReadonlyArray<[string, string]> = [
  ["hoje", "Hoje"],
  ["ontem", "Ontem"],
  ["semana", "Semana"],
  ["mes", "Mes"],
  ["tudo", "Tudo"],
];

export function Clientes() {
  const qc = useQueryClient();
  const leadsQuery = useLeads();
  const allLeads = leadsQuery.data ?? null;
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("hoje");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  // applyLeadsFilter: filtra por período e depois por busca (nome/telefone).
  const filtered = useMemo(() => {
    if (!allLeads) return [];
    let f = filterByDate(allLeads, "criado_em", period);
    if (query) {
      const q = query.toLowerCase();
      f = f.filter(
        (l) =>
          (l.nome || "").toLowerCase().includes(q) ||
          (l.telefone || "").includes(query)
      );
    }
    return f;
  }, [allLeads, query, period]);

  return (
    <div className="page-fade">
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: "1rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <span style={{ color: "var(--vx-muted)", fontSize: 15 }}>⌕</span>
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="filter-bar">
          {PERIODS.map(([value, label]) => (
            <button
              key={value}
              className={`filter-btn${period === value ? " active" : ""}`}
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setNewOpen(true)}>
          + Novo cliente
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <LeadsTable
            leads={filtered}
            loading={leadsQuery.isPending}
            onRowClick={setSelectedLead}
          />
        </div>
      </div>

      <LeadModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
      <NewLeadModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => qc.invalidateQueries({ queryKey: ["leads"] })}
      />
    </div>
  );
}
