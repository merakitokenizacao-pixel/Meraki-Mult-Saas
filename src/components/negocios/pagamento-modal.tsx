"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { showToast } from "@/lib/toast";
import { insertPagamento } from "@/lib/financeiro-db";
import { FORMAS, TIPOS_PAGAMENTO, moeda, num } from "@/lib/financeiro";
import type { AtendimentoFinanceiro } from "@/types/db";

// Registrar pagamento. Esta tela é a ÚNICA que escreve em `pagamentos` —
// nenhum workflow do n8n escreve aí, e não existe rota de API anônima.
//
// Não existe "cancelar pagamento": estorno entra com valor NEGATIVO. O saldo da
// view é `valor - soma(pagamentos)`, então o negativo faz o saldo voltar a
// subir sozinho e o histórico continua auditável.
export function PagamentoModal({
  atendimento,
  onClose,
  onSalvo,
}: {
  atendimento: AtendimentoFinanceiro | null;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [valorTxt, setValorTxt] = useState("");
  const [forma, setForma] = useState<string>("pix");
  const [tipo, setTipo] = useState<string>("integral");
  const [quem, setQuem] = useState("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  if (!atendimento) return null;

  const saldo = num(atendimento.saldo);
  const estorno = tipo === "estorno";

  function preencherSaldo() {
    // Sugestão, não imposição: pagamento parcial é normal na clínica.
    setValorTxt(String(saldo.toFixed(2)).replace(".", ","));
  }

  async function salvar() {
    setErro("");
    const bruto = Number(valorTxt.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(bruto) || bruto === 0) {
      setErro("Informe um valor diferente de zero.");
      return;
    }
    if (!atendimento!.lead_id) {
      setErro("Este atendimento não tem cliente vinculado.");
      return;
    }
    // O usuário digita sempre positivo; o sinal quem decide é o TIPO.
    const valor = estorno ? -Math.abs(bruto) : Math.abs(bruto);

    setSalvando(true);
    try {
      await insertPagamento({
        lead_id: atendimento!.lead_id,
        agendamento_id: atendimento!.id,
        valor,
        forma,
        tipo,
        registrado_por: quem,
        observacao: obs,
      });
      showToast(
        estorno ? "Estorno registrado" : "Pagamento registrado",
        "success"
      );
      onSalvo();
      onClose();
    } catch (e) {
      setErro((e as Error).message || "Não foi possível registrar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open onClose={onClose} width={520}>
      <div className="neg-pg-titulo">Registrar pagamento</div>
      <div className="neg-pg-cabeca">
        <div className="neg-pg-cliente">{atendimento.cliente || "—"}</div>
        <div className="neg-pg-servico">
          {atendimento.procedimento || atendimento.servico_texto || "—"}
        </div>
        <div className="neg-pg-saldo">
          <span>Valor {moeda(num(atendimento.valor))}</span>
          <span>Já pago {moeda(num(atendimento.pago))}</span>
          <strong className={saldo > 0 ? "aberto" : ""}>
            Falta {moeda(saldo)}
          </strong>
        </div>
      </div>

      <div className="neg-pg-form">
        <div>
          <label className="form-label" htmlFor="pg-tipo">
            Tipo
          </label>
          <select
            id="pg-tipo"
            className="form-input"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            {TIPOS_PAGAMENTO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label" htmlFor="pg-forma">
            Forma
          </label>
          <select
            id="pg-forma"
            className="form-input"
            value={forma}
            onChange={(e) => setForma(e.target.value)}
          >
            {FORMAS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="neg-pg-valor">
          <label className="form-label" htmlFor="pg-valor">
            Valor {estorno && <span className="neg-pg-aviso">sai negativo</span>}
          </label>
          <div className="neg-pg-valor-linha">
            <input
              id="pg-valor"
              className="form-input"
              inputMode="decimal"
              placeholder="0,00"
              value={valorTxt}
              onChange={(e) => setValorTxt(e.target.value)}
            />
            {saldo > 0 && !estorno && (
              <button
                type="button"
                className="neg-pg-atalho"
                onClick={preencherSaldo}
              >
                usar o saldo
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="form-label" htmlFor="pg-quem">
            Registrado por
          </label>
          <input
            id="pg-quem"
            className="form-input"
            placeholder="quem recebeu"
            value={quem}
            onChange={(e) => setQuem(e.target.value)}
          />
        </div>

        <div className="neg-pg-obs">
          <label className="form-label" htmlFor="pg-obs">
            Observação
          </label>
          <input
            id="pg-obs"
            className="form-input"
            placeholder="opcional"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
        </div>
      </div>

      {erro && <div className="neg-pg-erro">{erro}</div>}

      <div className="neg-pg-acoes">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={salvar}
          disabled={salvando}
        >
          {salvando ? "Salvando…" : estorno ? "Lançar estorno" : "Registrar"}
        </button>
      </div>
    </Modal>
  );
}
