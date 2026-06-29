"use client";

import { useEffect } from "react";

// Modal leve replicando o overlay do legacy (.modal-overlay/.modal/.modal-close):
// fecha no ESC, no clique fora e trava o scroll do body. Reutilizável nas telas.
export function Modal({
  open,
  onClose,
  children,
  width,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number | string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        style={width ? { width } : undefined}
        role="dialog"
        aria-modal="true"
      >
        <button className="modal-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
