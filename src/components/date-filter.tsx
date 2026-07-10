"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// Filtro de período em dropdown (mostra o atual; clica e abre as opções).
// Reutilizável (Clientes, Dashboard, …).
export function DateFilter({
  value,
  options,
  onChange,
  compact = false,
}: {
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find(([v]) => v === value)?.[1] ?? value;

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

  return (
    <div className="date-filter" ref={ref}>
      <button
        type="button"
        className={`date-filter-trigger${compact ? " compact" : ""}${open ? " open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current}
        <ChevronDown size={14} strokeWidth={1.5} className="chev" />
      </button>
      {open && (
        <div className="date-filter-menu" role="listbox">
          {options.map(([v, label]) => (
            <button
              type="button"
              key={v}
              role="option"
              aria-selected={v === value}
              className={`date-filter-item${v === value ? " active" : ""}`}
              onClick={() => {
                onChange(v);
                setOpen(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
