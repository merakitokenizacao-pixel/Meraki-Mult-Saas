"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MoreVertical, Plus } from "lucide-react";
import { showToast } from "@/lib/toast";
import { Modal } from "@/components/modal";
import {
  chaveCelula,
  criarProcedimento,
  definirAtivoProcedimento,
  desmarcar,
  getMatriz,
  marcar,
  renomearProcedimento,
  type DadosMatriz,
  type Vinculo,
} from "@/lib/matriz-procedimentos";

// Quem faz o quê: procedimentos nas linhas, profissionais nas colunas.
//
// Nem toda profissional faz todo procedimento. A Rozaria trabalha quinta das 8
// às 20, mas não faz um dos procedimentos — sem esta matriz, a agenda oferece
// aquele horário para aquele serviço e alguém tem que desmarcar depois.
//
// Salvamento é AUTOSAVE OTIMISTA, sem botão "Salvar": com 80 células ninguém
// acha o botão, e um erro no meio deixaria a tela mostrando um estado que o
// banco não tem. Aqui a célula muda na hora e VOLTA se a escrita falhar.

const CHAVE = ["matriz-procedimentos"];

export function SecaoMatriz() {
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: CHAVE,
    queryFn: getMatriz,
  });

  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string | null; nome: string } | null>(
    null
  );
  const [salvando, setSalvando] = useState(false);
  // Células em voo, para não disparar duas escritas no mesmo par.
  const [emVoo, setEmVoo] = useState<Set<string>>(new Set());

  const marcadas = useMemo(() => {
    const s = new Set<string>();
    for (const v of data?.vinculos ?? [])
      s.add(chaveCelula(v.profissional_id, v.procedimento_id));
    return s;
  }, [data?.vinculos]);

  const procedimentos = useMemo(
    () =>
      (data?.procedimentos ?? []).filter((p) => mostrarInativos || p.ativo),
    [data?.procedimentos, mostrarInativos]
  );
  const inativos = (data?.procedimentos ?? []).filter((p) => !p.ativo).length;
  const profissionais = data?.profissionais ?? [];

  /**
   * Aplica no cache ANTES da rede e desfaz se der errado.
   *
   * O cache é a fonte da tela, então mexer nele é o que faz a marcação
   * aparecer na hora. Guardar o estado anterior e restaurá-lo é o que impede
   * a tela de mentir quando a escrita falha — sem isso a célula ficaria
   * marcada e o banco não.
   */
  async function aplicar(pares: Vinculo[], ligar: boolean) {
    if (pares.length === 0) return;
    const chaves = pares.map((p) => chaveCelula(p.profissional_id, p.procedimento_id));
    const anterior = qc.getQueryData<DadosMatriz>(CHAVE);
    if (!anterior) return;

    setEmVoo((s) => new Set([...s, ...chaves]));
    qc.setQueryData<DadosMatriz>(CHAVE, (d) => {
      if (!d) return d;
      const fora = new Set(chaves);
      const restantes = d.vinculos.filter(
        (v) => !fora.has(chaveCelula(v.profissional_id, v.procedimento_id))
      );
      return { ...d, vinculos: ligar ? [...restantes, ...pares] : restantes };
    });

    try {
      if (ligar) await marcar(pares);
      else await desmarcar(pares);
    } catch {
      qc.setQueryData<DadosMatriz>(CHAVE, anterior);
      showToast(
        pares.length === 1
          ? "Não deu para salvar essa alteração"
          : "Não deu para salvar — nada foi alterado",
        "error"
      );
    } finally {
      setEmVoo((s) => {
        const n = new Set(s);
        for (const c of chaves) n.delete(c);
        return n;
      });
    }
  }

  function alternarCelula(profId: string, procId: string) {
    const k = chaveCelula(profId, procId);
    if (emVoo.has(k)) return;
    aplicar([{ profissional_id: profId, procedimento_id: procId }], !marcadas.has(k));
  }

  // Linha e coluna inteiras vão numa requisição só. Em 20 requisições soltas,
  // uma falha no meio deixaria metade aplicada e metade não.
  function alternarColuna(profId: string) {
    const pares = procedimentos.map((p) => ({
      profissional_id: profId,
      procedimento_id: p.id,
    }));
    // Se JÁ faz todos, o clique desmarca; senão, completa o que falta.
    const todos = pares.every((p) =>
      marcadas.has(chaveCelula(p.profissional_id, p.procedimento_id))
    );
    aplicar(pares, !todos);
  }

  function alternarLinha(procId: string) {
    const pares = profissionais
      // Profissional inativa fica de fora do lote: a coluna dela está
      // desabilitada, e marcá-la por tabela seria mudar o que a tela mostra
      // como intocável.
      .filter((p) => p.ativo)
      .map((p) => ({ profissional_id: p.id, procedimento_id: procId }));
    const todos = pares.every((p) =>
      marcadas.has(chaveCelula(p.profissional_id, p.procedimento_id))
    );
    aplicar(pares, !todos);
  }

  async function salvarProcedimento() {
    const nome = editando?.nome.trim();
    if (!nome) return;
    setSalvando(true);
    try {
      if (editando?.id) await renomearProcedimento(editando.id, nome);
      else await criarProcedimento(nome);
      await qc.invalidateQueries({ queryKey: CHAVE });
      setEditando(null);
    } catch (e) {
      const codigo = (e as { code?: string })?.code;
      showToast(
        codigo === "23505"
          ? "Já existe um procedimento com esse nome"
          : "Não deu para salvar o procedimento",
        "error"
      );
    } finally {
      setSalvando(false);
    }
  }

  async function desativar(id: string, ativo: boolean) {
    setMenuAberto(null);
    try {
      await definirAtivoProcedimento(id, ativo);
      await qc.invalidateQueries({ queryKey: CHAVE });
    } catch {
      showToast("Não deu para mudar o procedimento", "error");
    }
  }

  if (isPending) {
    return (
      <div className="config-card mtz-vazio">
        <Loader2 size={16} className="mtz-girando" /> Carregando…
      </div>
    );
  }
  if (error) {
    return <div className="config-card mtz-vazio">Não foi possível carregar.</div>;
  }

  return (
    <>
      <div className="config-card">
        <div className="mtz-topo">
          <p className="mtz-explica">
            Marque o que cada profissional atende. A agenda não deve oferecer um
            horário para quem não faz o procedimento.
          </p>
          <button
            type="button"
            className="btn-primary mtz-novo"
            onClick={() => setEditando({ id: null, nome: "" })}
          >
            <Plus size={13} strokeWidth={2} /> Novo procedimento
          </button>
        </div>

        <div className="mtz-rolagem">
          <table className="mtz-tabela">
            <thead>
              <tr>
                <th className="mtz-canto" />
                {profissionais.map((p) => {
                  const feitos = procedimentos.filter((pr) =>
                    marcadas.has(chaveCelula(p.id, pr.id))
                  ).length;
                  return (
                    <th
                      key={p.id}
                      className={`mtz-col${p.ativo ? "" : " inativa"}`}
                    >
                      <button
                        type="button"
                        className="mtz-col-btn"
                        disabled={!p.ativo}
                        onClick={() => alternarColuna(p.id)}
                        title={
                          p.ativo
                            ? "Marcar ou desmarcar todos"
                            : "Profissional inativa"
                        }
                      >
                        <span className="mtz-ponto" style={{ background: p.cor }} />
                        <span className="mtz-col-nome">{p.nome}</span>
                      </button>
                      <span className="mtz-contador">
                        {feitos} de {procedimentos.length}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {procedimentos.map((pr) => (
                <tr key={pr.id}>
                  <th
                    scope="row"
                    className={`mtz-linha${pr.ativo ? "" : " inativo"}`}
                  >
                    <button
                      type="button"
                      className="mtz-linha-btn"
                      onClick={() => alternarLinha(pr.id)}
                      title="Marcar ou desmarcar todas"
                    >
                      {pr.nome}
                      {!pr.ativo && <span className="mtz-selo">inativo</span>}
                    </button>

                    <div className="mtz-menu-wrap">
                      <button
                        type="button"
                        className="mtz-menu-btn"
                        aria-label={`Ações de ${pr.nome}`}
                        aria-expanded={menuAberto === pr.id}
                        onClick={() =>
                          setMenuAberto((m) => (m === pr.id ? null : pr.id))
                        }
                      >
                        <MoreVertical size={13} strokeWidth={2} />
                      </button>
                      {menuAberto === pr.id && (
                        <>
                          {/* Captura o clique fora sem listener global: o
                              overlay some junto com o menu. */}
                          <div
                            className="mtz-menu-fora"
                            onClick={() => setMenuAberto(null)}
                          />
                          <div className="mtz-menu" role="menu">
                            <button
                              type="button"
                              onClick={() => {
                                setEditando({ id: pr.id, nome: pr.nome });
                                setMenuAberto(null);
                              }}
                            >
                              Renomear
                            </button>
                            <button
                              type="button"
                              onClick={() => desativar(pr.id, !pr.ativo)}
                            >
                              {pr.ativo ? "Desativar" : "Reativar"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </th>

                  {profissionais.map((p) => {
                    const k = chaveCelula(p.id, pr.id);
                    const on = marcadas.has(k);
                    return (
                      <td key={p.id} className={p.ativo ? undefined : "inativa"}>
                        <button
                          type="button"
                          className={`mtz-check${on ? " on" : ""}`}
                          disabled={!p.ativo || emVoo.has(k)}
                          aria-pressed={on}
                          aria-label={`${p.nome} faz ${pr.nome}`}
                          onClick={() => alternarCelula(p.id, pr.id)}
                        >
                          {on && <Check size={11} strokeWidth={3} />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {inativos > 0 && (
          <button
            type="button"
            className="mtz-inativos"
            onClick={() => setMostrarInativos((v) => !v)}
          >
            {mostrarInativos
              ? "ocultar inativos"
              : `mostrar ${inativos} inativo${inativos === 1 ? "" : "s"}`}
          </button>
        )}
      </div>

      {editando && (
        <Modal open onClose={() => setEditando(null)} width={380}>
          <div className="mtz-modal-titulo">
            {editando.id ? "Renomear procedimento" : "Novo procedimento"}
          </div>
          <label className="lead-label" htmlFor="mtz-nome">
            Nome
          </label>
          <input
            id="mtz-nome"
            className="lead-input"
            value={editando.nome}
            autoFocus
            placeholder="Como a clínica chama esse procedimento"
            onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && salvarProcedimento()}
          />
          <div className="mtz-modal-acoes">
            <button
              type="button"
              className="btn-primary"
              disabled={salvando || !editando.nome.trim()}
              onClick={salvarProcedimento}
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
