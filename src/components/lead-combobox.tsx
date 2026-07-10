"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { formatTelefone } from "@/lib/format";
import type { Lead } from "@/types/db";

const MAX_VISIVEIS = 50;

// Seletor de cliente com busca (substitui o <select> nativo, inviável com
// centenas de leads). Filtra por nome ou telefone enquanto digita.
export function LeadCombobox({
  leads,
  value,
  onChange,
}: {
  leads: Lead[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = leads.find((l) => l.id === value) ?? null;

  const ordenados = useMemo(
    () =>
      [...leads].sort((a, b) =>
        (a.nome || a.telefone || "").localeCompare(b.nome || b.telefone || "", "pt-BR")
      ),
    [leads]
  );

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordenados;
    return ordenados.filter(
      (l) =>
        (l.nome || "").toLowerCase().includes(q) ||
        (l.telefone || "").includes(query.trim())
    );
  }, [ordenados, query]);

  const visiveis = filtrados.slice(0, MAX_VISIVEIS);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function abrir() {
    setQuery("");
    setOpen(true);
    inputRef.current?.focus();
  }

  function selecionar(id: string) {
    onChange(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="lead-combo" ref={ref}>
      <div className="form-input lead-combo-control" onClick={abrir}>
        <Search size={14} strokeWidth={1.5} className="lead-combo-icon" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : selected ? selected.nome || selected.telefone : ""}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar cliente por nome ou telefone..."
          aria-label="Buscar cliente"
        />
        {selected && !open && (
          <button
            type="button"
            className="lead-combo-clear"
            aria-label="Limpar cliente"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="lead-combo-menu" role="listbox">
          {visiveis.length === 0 ? (
            <div className="lead-combo-empty">Nenhum cliente encontrado</div>
          ) : (
            <>
              {visiveis.map((l) => (
                <button
                  type="button"
                  key={l.id}
                  role="option"
                  aria-selected={l.id === value}
                  className={`lead-combo-item${l.id === value ? " active" : ""}`}
                  onClick={() => selecionar(l.id)}
                >
                  <span className="nome">{l.nome || "—"}</span>
                  <span className="tel">{formatTelefone(l.telefone)}</span>
                </button>
              ))}
              {filtrados.length > MAX_VISIVEIS && (
                <div className="lead-combo-hint">
                  +{filtrados.length - MAX_VISIVEIS} — refine a busca
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
