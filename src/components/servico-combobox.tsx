"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import {
  ROTULO_CATEGORIA,
  normalizar,
  ordenarParaSelecao,
  type ServicoCatalogo,
} from "@/lib/servicos";

const MAX_VISIVEIS = 60;

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Seletor de serviço com busca — mesma anatomia do LeadCombobox, de propósito:
// quem agenda usa os dois campos seguidos e não deveria trocar de lógica no
// meio do formulário.
//
// A lista vem de `documentos`, o catálogo que a Laura também lê. Antes era
// um <select> com 8 opções fixas no código, que não cobria nem metade do que a
// clínica faz — e o que ficava de fora virava "Outro", sem preço.
//
// Busca por nome, categoria e SINÔNIMO: quem digita "virilha" precisa achar
// depilação, e o sinônimo é justamente o vocabulário que a cliente usa.
export function ServicoCombobox({
  servicos,
  value,
  onChange,
  carregando = false,
}: {
  servicos: ServicoCatalogo[];
  /** O nome do serviço — é o que vai para `agendamentos.servico` (texto). */
  value: string;
  onChange: (nome: string) => void;
  carregando?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ordenados = useMemo(() => ordenarParaSelecao(servicos), [servicos]);

  const filtrados = useMemo(() => {
    const q = normalizar(query);
    if (!q) return ordenados;
    return ordenados.filter((s) => {
      const cat = ROTULO_CATEGORIA[s.categoria] ?? s.categoria;
      return (
        normalizar(s.nome).includes(q) ||
        normalizar(cat).includes(q) ||
        s.sinonimos.some((sin) => normalizar(sin).includes(q))
      );
    });
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

  function selecionar(nome: string) {
    onChange(nome);
    setQuery("");
    setOpen(false);
  }

  // Categoria só aparece quando MUDA — vira cabeçalho de grupo na lista.
  let categoriaAnterior = "";

  return (
    <div className="lead-combo" ref={ref}>
      <div
        className="form-input lead-combo-control"
        onClick={() => {
          setQuery("");
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <Search size={14} strokeWidth={1.5} className="lead-combo-icon" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : value}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={
            carregando ? "Carregando serviços…" : "Buscar serviço ou área..."
          }
          aria-label="Buscar serviço"
        />
        {value && !open && (
          <button
            type="button"
            className="lead-combo-clear"
            aria-label="Limpar serviço"
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
            <div className="lead-combo-empty">
              {carregando ? "Carregando…" : "Nenhum serviço encontrado"}
            </div>
          ) : (
            <>
              {visiveis.map((s) => {
                const cat = ROTULO_CATEGORIA[s.categoria] ?? s.categoria;
                const novaCategoria = !query && cat !== categoriaAnterior;
                if (novaCategoria) categoriaAnterior = cat;
                return (
                  <div key={s.id}>
                    {novaCategoria && (
                      <div className="servico-combo-grupo">{cat}</div>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={s.nome === value}
                      className={`lead-combo-item${s.nome === value ? " active" : ""}`}
                      onClick={() => selecionar(s.nome)}
                    >
                      <span className="nome">{s.nome}</span>
                      <span className="tel">
                        {/* Faixa quando o preço varia por área ou duração —
                            esconder isso faria o laser (R$ 20 a R$ 120) parecer
                            ter preço único. */}
                        {s.preco == null
                          ? "—"
                          : s.faixa
                            ? `${brl(s.faixa.min)}–${brl(s.faixa.max)}`
                            : brl(s.preco)}
                      </span>
                    </button>
                  </div>
                );
              })}
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
