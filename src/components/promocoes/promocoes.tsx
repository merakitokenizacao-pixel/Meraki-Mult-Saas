"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone, Plus, Tag, TriangleAlert } from "lucide-react";
import { showToast } from "@/lib/toast";
import {
  estaNoAr,
  hojeBrasilia,
  ordenar,
  quandoVale,
  rotuloValidade,
  situacaoDe,
  type Promocao,
} from "@/lib/promocao";
import { PromocaoModal } from "@/components/promocoes/promocao-modal";

async function getPromocoes(): Promise<Promocao[]> {
  const res = await fetch("/api/painel/promocoes");
  if (!res.ok) throw new Error("falha");
  const j = (await res.json()) as { promocoes: Promocao[] };
  return j.promocoes;
}

const TOM: Record<string, { bg: string; fg: string }> = {
  vigente: { bg: "var(--mk-green-bg)", fg: "var(--mk-green)" },
  vencida: { bg: "var(--mk-surface3)", fg: "var(--mk-muted)" },
  desativada: { bg: "var(--mk-surface3)", fg: "var(--mk-muted)" },
};
const ROTULO: Record<string, string> = {
  vigente: "VIGENTE",
  vencida: "VENCIDA",
  desativada: "DESATIVADA",
};

export function Promocoes() {
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ["promocoes"],
    queryFn: getPromocoes,
  });
  const [editando, setEditando] = useState<Promocao | null>(null);
  const [aberto, setAberto] = useState(false);

  // Hoje em Brasília, calculado uma vez por render: a virada do dia que vale
  // é a da clínica, não a do servidor.
  const hoje = useMemo(() => hojeBrasilia(), []);
  const lista = useMemo(() => ordenar(data ?? [], hoje), [data, hoje]);
  const noAr = useMemo(
    () => (data ?? []).filter((p) => estaNoAr(p, hoje)).length,
    [data, hoje]
  );

  // O anúncio está apontando para uma promoção que não está mais no ar?
  // Quem clica no anúncio pergunta por uma oferta que a Laura não pode dar.
  const anuncioMorto = useMemo(
    () =>
      (data ?? []).find((p) => p.anuncio_ativo && !estaNoAr(p, hoje)) ?? null,
    [data, hoje]
  );

  const recarregar = () => qc.invalidateQueries({ queryKey: ["promocoes"] });

  async function alternar(p: Promocao) {
    const res = await fetch(`/api/painel/promocoes/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativa: !p.ativa }),
    });
    if (!res.ok) {
      showToast("Não foi possível alterar.", "error");
      return;
    }
    showToast(
      p.ativa
        ? `"${p.titulo}" saiu do ar — a Laura para de oferecer`
        : `"${p.titulo}" voltou ao ar`,
      "info"
    );
    recarregar();
  }

  function abrirNova() {
    setEditando(null);
    setAberto(true);
  }

  return (
    <div className="page-fade">
      {/* Cabeçalho: o contador é o número que a Laura está oferecendo AGORA */}
      <div className="promo-header">
        <div>
          <div className="promo-contador">
            <span className="promo-contador-num">{isPending ? "—" : noAr}</span>
            <span>
              {noAr === 1 ? "promoção ativa agora" : "promoções ativas agora"}
            </span>
          </div>
          <p className="promo-sub">
            É o que a Laura está oferecendo nas conversas neste momento.
            Alterações valem na mensagem seguinte.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={abrirNova}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={15} strokeWidth={2} /> Nova promoção
        </button>
      </div>

      {/* Alerta forte: o anúncio pago aponta para uma oferta que acabou */}
      {anuncioMorto && (
        <div className="promo-alerta-anuncio">
          <TriangleAlert size={17} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>O anúncio está apontando para uma promoção fora do ar.</strong>
            <p>
              “{anuncioMorto.titulo}” está marcada como a promoção do anúncio,
              mas {situacaoDe(anuncioMorto, hoje) === "vencida"
                ? "o prazo dela já passou"
                : "ela está desativada"}
              . Quem clicar no anúncio vai perguntar por uma oferta que a Laura
              não pode dar.
            </p>
            <button
              className="promo-alerta-acao"
              onClick={() => {
                setEditando(anuncioMorto);
                setAberto(true);
              }}
            >
              Resolver agora
            </button>
          </div>
        </div>
      )}

      {isPending ? (
        <div className="loading">
          <div className="spinner" /> Carregando...
        </div>
      ) : error ? (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 9, color: "var(--mk-red)", fontSize: 13 }}>
            <TriangleAlert size={16} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} />
            Não foi possível carregar as promoções.
          </div>
        </div>
      ) : lista.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <Tag size={26} strokeWidth={1.4} style={{ color: "var(--mk-accent)", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            Nenhuma promoção cadastrada
          </div>
          <p style={{ fontSize: 13, color: "var(--mk-muted)", maxWidth: 380, margin: "0 auto 16px", lineHeight: 1.6 }}>
            Enquanto não houver promoção ativa, a Laura fala só o preço normal
            dos procedimentos.
          </p>
          <button className="btn-primary" onClick={abrirNova}>
            Criar a primeira
          </button>
        </div>
      ) : (
        <div className="promo-grid">
          {lista.map((p) => {
            const sit = situacaoDe(p, hoje);
            const tom = TOM[sit];
            const fora = sit !== "vigente";
            return (
              <div
                key={p.id}
                className={`promo-card${fora ? " fora" : ""}`}
                onClick={() => {
                  setEditando(p);
                  setAberto(true);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setEditando(p);
                    setAberto(true);
                  }
                }}
              >
                <div className="promo-badges">
                  <span
                    className="promo-badge"
                    style={{ background: tom.bg, color: tom.fg }}
                  >
                    {ROTULO[sit]}
                  </span>
                  {p.anuncio_ativo && (
                    <span
                      className="promo-badge"
                      style={{ background: "var(--mk-amber-bg)", color: "var(--mk-amber)" }}
                    >
                      <Megaphone size={10} strokeWidth={2.2} /> NO ANÚNCIO
                    </span>
                  )}
                </div>

                <h3 className="promo-titulo">{p.titulo}</h3>
                <div className="promo-valor">{p.valor_promocional}</div>
                <p className="promo-desc">{p.descricao}</p>

                <div className="promo-meta">
                  <span>{quandoVale(p.dia_semana)}</span>
                  <span className="promo-meta-sep">·</span>
                  <span>{rotuloValidade(p, hoje)}</span>
                </div>

                {sit === "vencida" ? (
                  <>
                    <p className="promo-explica">
                      O prazo passou — a Laura já parou de oferecer.
                    </p>
                    {/* Reativar não adiantaria: continuaria vencida. O que
                        resolve é mudar a data, então o botão abre o formulário. */}
                    <button
                      className="promo-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditando(p);
                        setAberto(true);
                      }}
                    >
                      Renovar prazo
                    </button>
                  </>
                ) : (
                  <button
                    className="promo-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      alternar(p);
                    }}
                  >
                    {p.ativa ? "Tirar do ar" : "Reativar"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PromocaoModal
        aberto={aberto}
        promocao={editando}
        promocoes={data ?? []}
        onClose={() => setAberto(false)}
        onSalvo={recarregar}
      />
    </div>
  );
}
