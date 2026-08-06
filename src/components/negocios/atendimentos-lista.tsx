"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, TriangleAlert } from "lucide-react";
import { useAtendimentos, useCategorias } from "@/lib/hooks";
import { PAGINA_ATENDIMENTOS } from "@/lib/financeiro-db";
import {
  STATUS_ATENDIMENTO,
  moeda,
  nomeDoAtendimento,
  num,
  type IntervaloISO,
} from "@/lib/financeiro";
import { PagamentoModal } from "@/components/negocios/pagamento-modal";
import type { AtendimentoFinanceiro } from "@/types/db";

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

const CLASSE_STATUS: Record<string, string> = {
  realizado: "ok",
  confirmado: "info",
  pendente: "espera",
  cancelado: "ruim",
};

export function AtendimentosLista({
  intervalo,
  soSemProcedimentoInicial = false,
}: {
  intervalo: IntervaloISO;
  soSemProcedimentoInicial?: boolean;
}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [categoria, setCategoria] = useState("");
  const [soPendente, setSoPendente] = useState(false);
  const [soSemProc, setSoSemProc] = useState(soSemProcedimentoInicial);
  const [pagina, setPagina] = useState(0);
  const [pagando, setPagando] = useState<AtendimentoFinanceiro | null>(null);

  const filtro = {
    intervalo,
    status: status || undefined,
    categoria: categoria || undefined,
    soPendente,
    soSemProcedimento: soSemProc,
  };
  const q = useAtendimentos(filtro, pagina);
  const categorias = useCategorias();

  const linhas = q.data?.linhas ?? [];
  const total = q.data?.total ?? 0;
  const ultimaPagina = Math.max(0, Math.ceil(total / PAGINA_ATENDIMENTOS) - 1);

  // Qualquer troca de filtro volta para a primeira página — senão a pessoa
  // filtra, cai numa página que não existe mais e vê uma lista vazia.
  function trocar(fn: () => void) {
    fn();
    setPagina(0);
  }

  return (
    <>
      <div className="neg-filtros">
        <select
          className="neg-select"
          value={status}
          onChange={(e) => trocar(() => setStatus(e.target.value))}
          aria-label="Status"
          disabled={soPendente}
        >
          {STATUS_ATENDIMENTO.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          className="neg-select"
          value={categoria}
          onChange={(e) => trocar(() => setCategoria(e.target.value))}
          aria-label="Categoria"
        >
          <option value="">Todas as categorias</option>
          {(categorias.data ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className="neg-toggle">
          <input
            type="checkbox"
            checked={soPendente}
            onChange={(e) => trocar(() => setSoPendente(e.target.checked))}
          />
          Só o que falta receber
        </label>

        <label className="neg-toggle">
          <input
            type="checkbox"
            checked={soSemProc}
            onChange={(e) => trocar(() => setSoSemProc(e.target.checked))}
          />
          Só sem procedimento
        </label>

        <span className="neg-filtros-total">
          {q.isPending ? "…" : `${total} ${total === 1 ? "linha" : "linhas"}`}
        </span>
      </div>

      <div className="neg-tabela-wrap">
        <table className="neg-tabela">
          <thead>
            <tr>
              <th>Data</th>
              <th>Cliente</th>
              <th>Procedimento</th>
              <th>Status</th>
              <th className="num">Valor</th>
              <th className="num">Pago</th>
              <th className="num">Saldo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {q.isPending ? (
              <tr>
                <td colSpan={8} className="neg-td-vazio">
                  Carregando…
                </td>
              </tr>
            ) : linhas.length === 0 ? (
              <tr>
                <td colSpan={8} className="neg-td-vazio">
                  Nenhum atendimento com esses filtros.
                </td>
              </tr>
            ) : (
              linhas.map((a) => {
                const saldo = num(a.saldo);
                const ehPacote = Boolean(a.pacote_vendido_id);
                return (
                  <tr key={a.id}>
                    <td className="mono">{dataCurta(a.data_agendamento)}</td>
                    <td className="trunc" title={a.cliente ?? ""}>
                      {a.cliente || "—"}
                    </td>
                    <td className="trunc">
                      {/* Nome do catálogo quando existe; texto livre quando não. */}
                      {nomeDoAtendimento(a.procedimento, a.servico_texto)}
                      {!a.procedimento_id && (
                        <span className="neg-tag-conferir" title="Sem vínculo com o catálogo">
                          <TriangleAlert size={11} />
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`neg-status ${CLASSE_STATUS[a.status] ?? ""}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="num mono">
                      {/* Sessão de pacote vale 0 aqui de propósito: a receita foi
                          reconhecida na venda. Somar preço de tabela contaria 2×. */}
                      {ehPacote ? (
                        <span className="neg-pacote-marca" title="Sessão de pacote — já paga na venda">
                          pacote
                        </span>
                      ) : (
                        moeda(num(a.valor))
                      )}
                    </td>
                    <td className="num mono">{moeda(num(a.pago))}</td>
                    <td className={`num mono ${saldo > 0 ? "aberto" : ""}`}>
                      {moeda(saldo)}
                    </td>
                    <td className="num">
                      {a.lead_id && (
                        <button
                          type="button"
                          className="neg-btn-pagar"
                          onClick={() => setPagando(a)}
                          title="Registrar pagamento"
                        >
                          <CircleDollarSign size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total > PAGINA_ATENDIMENTOS && (
        <div className="neg-paginacao">
          <button
            type="button"
            className="neg-pag-btn"
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            disabled={pagina === 0}
          >
            Anterior
          </button>
          <span className="neg-pag-txt">
            {pagina + 1} de {ultimaPagina + 1}
          </span>
          <button
            type="button"
            className="neg-pag-btn"
            onClick={() => setPagina((p) => Math.min(ultimaPagina, p + 1))}
            disabled={pagina >= ultimaPagina}
          >
            Próxima
          </button>
        </div>
      )}

      <PagamentoModal
        atendimento={pagando}
        onClose={() => setPagando(null)}
        // Invalida o PREFIXO: KPIs, composição, formas e a própria lista se
        // atualizam juntos, e o saldo da linha cai na hora.
        onSalvo={() => qc.invalidateQueries({ queryKey: ["financeiro"] })}
      />
    </>
  );
}
