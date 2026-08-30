"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  GripVertical,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { Confirmar } from "@/components/confirmar";
import { useTenant } from "@/components/tenant-provider";
import { Segmentado } from "@/components/segmentado";
import { showToast } from "@/lib/toast";
import {
  ATALHOS_VALIDADE,
  NUNCA_VENCE,
  ROTULO_TIPO,
  TIPOS,
  chaveDaPergunta,
  limparChave,
  type CampoRequisito,
  type TipoCampo,
} from "@/lib/requisitos";
import {
  contarRespostas,
  contarRespostasComChave,
  criarCampo,
  excluirRequisito,
  criarRequisito,
  desvincularProcedimento,
  listarCampos,
  listarProcedimentos,
  listarRequisitos,
  listarVinculos,
  removerCampo,
  reordenarCampos,
  salvarCampo,
  salvarRequisito,
  vincularProcedimento,
} from "@/lib/requisitos-db";

// Onde a clínica define O QUE precisa estar respondido antes de um
// procedimento acontecer.
//
// Nada aqui sabe o que é uma ficha de contraindicação: as perguntas, os tipos e
// a regra de alerta vêm todos do banco. É o que permite uma odonto configurar
// "usa anticoagulante" e uma veterinária configurar "vacina vencida", sem
// ninguém tocar em código.

const CHAVE = ["requisitos"];

export function SecaoRequisitos() {
  const qc = useQueryClient();
  const { atual: clinica } = useTenant();
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [arquivadosAbertos, setArquivadosAbertos] = useState(false);
  // `usos` guarda a contagem de respostas: `null` enquanto conta, número
  // depois. É o que decide entre excluir e explicar por que não dá.
  const [excluindo, setExcluindo] = useState<{
    id: string;
    nome: string;
    usos: number;
  } | null>(null);

  async function alternarAtivo(id: string, ativo: boolean) {
    try {
      await salvarRequisito(id, { ativo });
      qc.invalidateQueries({ queryKey: CHAVE });
    } catch {
      showToast("Não foi possível salvar", "error");
    }
  }

  async function pedirExclusao(id: string, nome: string) {
    setMenuAberto(null);
    try {
      setExcluindo({ id, nome, usos: await contarRespostas(id) });
    } catch {
      showToast("Não foi possível conferir o histórico", "error");
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    const alvo = excluindo;
    setExcluindo(null);
    try {
      await excluirRequisito(alvo.id);
      showToast(`"${alvo.nome}" foi excluído`, "info");
      qc.invalidateQueries({ queryKey: CHAVE });
    } catch {
      showToast("Não foi possível excluir", "error");
    }
  }

  const { data, isPending, error } = useQuery({
    queryKey: CHAVE,
    queryFn: listarRequisitos,
  });

  const aberto = useMemo(
    () => (data ?? []).find((r) => r.id === abertoId) ?? null,
    [data, abertoId]
  );
  const ativos = useMemo(() => (data ?? []).filter((r) => r.ativo), [data]);
  const desativados = useMemo(() => (data ?? []).filter((r) => !r.ativo), [data]);

  async function novo() {
    if (!clinica) return;
    try {
      const r = await criarRequisito(clinica.tenant_id, "Novo requisito");
      await qc.invalidateQueries({ queryKey: CHAVE });
      setAbertoId(r.id);
    } catch {
      showToast("Não foi possível criar o requisito", "error");
    }
  }

  if (isPending) return <div className="config-card rq-cfg-vazio">Carregando…</div>;
  if (error) {
    return <div className="config-card rq-cfg-vazio">Não foi possível carregar.</div>;
  }

  if (aberto) {
    return (
      <EditorRequisito
        requisitoId={aberto.id}
        tenantId={clinica?.tenant_id ?? null}
        onVoltar={() => {
          setAbertoId(null);
          qc.invalidateQueries({ queryKey: CHAVE });
        }}
      />
    );
  }

  return (
    <div className="config-card">
      <div className="rq-cfg-topo">
        <p className="rq-cfg-explica">
          Antes de um procedimento acontecer, o que precisa estar respondido e
          válido. A agente manda o link pelo WhatsApp; a resposta volta para cá.
        </p>
        <button type="button" className="btn-primary" onClick={novo}>
          <Plus size={14} strokeWidth={2} /> Novo requisito
        </button>
      </div>

      {ativos.length === 0 && desativados.length === 0 ? (
        <p className="rq-cfg-vazio">Nenhum requisito configurado ainda.</p>
      ) : (
        <ul className="rq-cfg-lista">
          {ativos.map((r) => (
            <li key={r.id} className="rq-cfg-linha-item">
              <button
                type="button"
                className="rq-cfg-item"
                onClick={() => setAbertoId(r.id)}
              >
                <span className="rq-cfg-nome">{r.nome}</span>
                <span className="rq-cfg-meta">
                  {r.procedimentos} procedimento{r.procedimentos === 1 ? "" : "s"} ·{" "}
                  {r.perguntas} pergunta{r.perguntas === 1 ? "" : "s"} ·{" "}
                  {r.validade_dias === NUNCA_VENCE
                    ? "nunca vence"
                    : `vale ${r.validade_dias} dias`}
                </span>
                {r.bloqueia && <span className="rq-cfg-selo">bloqueia</span>}
              </button>

              <div className="prof-menu-wrap">
                <button
                  className="prof-menu-btn"
                  aria-haspopup="menu"
                  aria-expanded={menuAberto === r.id}
                  aria-label={`Mais ações para ${r.nome}`}
                  onClick={() => setMenuAberto(menuAberto === r.id ? null : r.id)}
                >
                  <MoreVertical size={14} strokeWidth={2} />
                </button>
                {menuAberto === r.id && (
                  <>
                    <div
                      className="prof-menu-fora"
                      onClick={() => setMenuAberto(null)}
                    />
                    <div className="prof-menu" role="menu">
                      {/* Renomear abre o editor, onde o campo Nome já mora —
                          um segundo lugar para renomear é um segundo lugar
                          para divergir. */}
                      <button
                        type="button"
                        role="menuitem"
                        className="prof-menu-item"
                        onClick={() => {
                          setMenuAberto(null);
                          setAbertoId(r.id);
                        }}
                      >
                        Renomear
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="prof-menu-item"
                        onClick={() => {
                          setMenuAberto(null);
                          alternarAtivo(r.id, false);
                        }}
                      >
                        Desativar
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="prof-menu-item destrutivo"
                        onClick={() => pedirExclusao(r.id, r.nome)}
                      >
                        Excluir
                      </button>
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ⚠️ DESATIVADO NÃO SOME DA TELA. Sumir faz a pessoa achar que apagou —
          e aí ela cria outro igual, ou procura o desfazer que não existe. */}
      {desativados.length > 0 && (
        <div className="arq-bloco">
          <button
            type="button"
            className="arq-cab"
            aria-expanded={arquivadosAbertos}
            onClick={() => setArquivadosAbertos((v) => !v)}
          >
            <span className="arq-seta" aria-hidden="true">
              <ChevronRight size={14} strokeWidth={2} />
            </span>
            Desativados ({desativados.length})
          </button>
          {arquivadosAbertos && (
            <div className="arq-corpo">
              {desativados.map((r) => (
                <div key={r.id} className="arq-item">
                  <span className="arq-nome">{r.nome}</span>
                  <button
                    type="button"
                    className="arq-acao"
                    onClick={() => alternarAtivo(r.id, true)}
                  >
                    Reativar
                  </button>
                  <button
                    type="button"
                    className="arq-acao destrutivo"
                    onClick={() => pedirExclusao(r.id, r.nome)}
                  >
                    Excluir
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Confirmar
        aberto={!!excluindo && excluindo.usos === 0}
        titulo={`Excluir o requisito ${excluindo?.nome ?? ""}?`}
        texto="As perguntas e os procedimentos vinculados somem junto. Isso não pode ser desfeito."
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />
      {/* Com resposta gravada não há botão de excluir: há o motivo escrito. */}
      <Confirmar
        aberto={!!excluindo && excluindo.usos > 0}
        titulo={`"${excluindo?.nome ?? ""}" não pode ser excluído`}
        texto={`Ele tem ${excluindo?.usos ?? 0} resposta${
          excluindo?.usos === 1 ? "" : "s"
        } gravada${excluindo?.usos === 1 ? "" : "s"}, e excluir apagaria essas respostas junto. Desative — ele para de ser exigido e o histórico fica.`}
        rotuloAcao="Desativar"
        onConfirmar={() => {
          if (excluindo) alternarAtivo(excluindo.id, false);
          setExcluindo(null);
        }}
        onCancelar={() => setExcluindo(null)}
      />
    </div>
  );
}

// ── Edição de um requisito ──────────────────────────────────────────────────

function EditorRequisito({
  requisitoId,
  tenantId,
  onVoltar,
}: {
  requisitoId: string;
  tenantId: string | null;
  onVoltar: () => void;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: CHAVE, queryFn: listarRequisitos });
  const req = (data ?? []).find((r) => r.id === requisitoId);

  const [nome, setNome] = useState(req?.nome ?? "");
  const [descricao, setDescricao] = useState(req?.descricao ?? "");
  const [validade, setValidade] = useState(req?.validade_dias ?? 180);
  const [bloqueia, setBloqueia] = useState(req?.bloqueia ?? false);
  const [urlBase, setUrlBase] = useState(req?.url_base ?? "");

  useEffect(() => {
    if (!req) return;
    setNome(req.nome);
    setDescricao(req.descricao ?? "");
    setValidade(req.validade_dias);
    setBloqueia(req.bloqueia);
    setUrlBase(req.url_base ?? "");
  }, [req]);

  async function salvar(campos: Parameters<typeof salvarRequisito>[1]) {
    try {
      await salvarRequisito(requisitoId, campos);
      qc.invalidateQueries({ queryKey: CHAVE });
    } catch {
      showToast("Não foi possível salvar", "error");
    }
  }

  return (
    <div className="rq-cfg-editor">
      <button type="button" className="rq-cfg-voltar" onClick={onVoltar}>
        <ArrowLeft size={14} strokeWidth={2} /> Todos os requisitos
      </button>

      <div className="config-card">
        <label className="rq-cfg-campo">
          <span className="rq-cfg-rotulo">Nome</span>
          <input
            className="form-input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onBlur={() => nome.trim() && salvar({ nome: nome.trim() })}
          />
        </label>

        <label className="rq-cfg-campo">
          <span className="rq-cfg-rotulo">Descrição</span>
          <textarea
            className="form-input"
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            onBlur={() => salvar({ descricao: descricao.trim() || null })}
          />
          <span className="rq-cfg-dica">
            Aparece no topo do formulário, para a cliente.
          </span>
        </label>

        <div className="rq-cfg-campo">
          <span className="rq-cfg-rotulo">Validade</span>
          <div className="rq-cfg-atalhos">
            {ATALHOS_VALIDADE.map(([dias, rotulo]) => (
              <button
                key={dias}
                type="button"
                className={`rq-cfg-atalho${validade === dias ? " marcado" : ""}`}
                onClick={() => {
                  setValidade(dias);
                  salvar({ validade_dias: dias });
                }}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="rq-cfg-campo">
          <span className="rq-cfg-rotulo">Ao faltar resposta</span>
          <Segmentado
            valor={bloqueia ? "bloquear" : "avisar"}
            onChange={(v) => {
              const b = v === "bloquear";
              setBloqueia(b);
              salvar({ bloqueia: b });
            }}
            opcoes={[
              { valor: "avisar", rotulo: "Avisar" },
              { valor: "bloquear", rotulo: "Bloquear o agendamento" },
            ]}
            rotulo="O que fazer quando falta resposta"
          />
          <span className="rq-cfg-dica">
            Avisar: o horário é marcado e a equipe é sinalizada. Bloquear: o
            horário não é marcado sem resposta válida.
          </span>
        </div>

        <label className="rq-cfg-campo">
          <span className="rq-cfg-rotulo">URL base</span>
          <input
            className="form-input"
            value={urlBase}
            onChange={(e) => setUrlBase(e.target.value)}
            onBlur={() => salvar({ url_base: urlBase.trim() || null })}
            placeholder="https://clinica.com.br/ficha"
          />
          <span className="rq-cfg-dica">
            Prefixo do link; o token é concatenado no fim.
          </span>
        </label>
      </div>

      <GradeProcedimentos requisitoId={requisitoId} tenantId={tenantId} />
      <ListaPerguntas requisitoId={requisitoId} tenantId={tenantId} />
    </div>
  );
}

// ── Quais procedimentos exigem ──────────────────────────────────────────────

function GradeProcedimentos({
  requisitoId,
  tenantId,
}: {
  requisitoId: string;
  tenantId: string | null;
}) {
  const qc = useQueryClient();
  const chave = ["requisito-procs", requisitoId];
  const { data, isPending } = useQuery({
    queryKey: chave,
    queryFn: async () => ({
      procedimentos: await listarProcedimentos(),
      vinculos: await listarVinculos(requisitoId),
    }),
  });

  const marcados = useMemo(
    () => new Set(data?.vinculos ?? []),
    [data?.vinculos]
  );
  const [emVoo, setEmVoo] = useState<Set<string>>(new Set());

  // Autosave OTIMISTA, como na grade de "Quem faz o quê": a célula muda na hora
  // e VOLTA se a escrita falhar. Com dezenas de procedimentos ninguém acha um
  // botão "Salvar", e um erro no meio deixaria a tela mostrando um estado que o
  // banco não tem.
  async function alternar(procId: string) {
    if (!tenantId || emVoo.has(procId)) return;
    const marcado = marcados.has(procId);
    setEmVoo((s) => new Set(s).add(procId));
    qc.setQueryData(chave, (v: typeof data) =>
      v
        ? {
            ...v,
            vinculos: marcado
              ? v.vinculos.filter((x) => x !== procId)
              : [...v.vinculos, procId],
          }
        : v
    );
    try {
      if (marcado) await desvincularProcedimento(requisitoId, procId);
      else await vincularProcedimento(tenantId, requisitoId, procId);
      qc.invalidateQueries({ queryKey: ["requisitos"] });
    } catch {
      qc.invalidateQueries({ queryKey: chave });
      showToast("Não foi possível salvar essa marcação", "error");
    } finally {
      setEmVoo((s) => {
        const n = new Set(s);
        n.delete(procId);
        return n;
      });
    }
  }

  return (
    <div className="config-card">
      <p className="rq-cfg-explica">
        Quais procedimentos exigem este requisito.
      </p>
      {isPending ? (
        <p className="rq-cfg-vazio">Carregando…</p>
      ) : (data?.procedimentos ?? []).length === 0 ? (
        <p className="rq-cfg-vazio">Nenhum procedimento cadastrado.</p>
      ) : (
        <div className="rq-cfg-grade">
          {(data?.procedimentos ?? []).map((p) => {
            const on = marcados.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className={`rq-cfg-proc${on ? " marcado" : ""}${
                  p.ativo ? "" : " inativo"
                }`}
                aria-pressed={on}
                onClick={() => alternar(p.id)}
              >
                {p.nome}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── As perguntas ────────────────────────────────────────────────────────────

function ListaPerguntas({
  requisitoId,
  tenantId,
}: {
  requisitoId: string;
  tenantId: string | null;
}) {
  const qc = useQueryClient();
  const chave = ["requisito-campos", requisitoId];
  const { data, isPending } = useQuery({
    queryKey: chave,
    queryFn: () => listarCampos(requisitoId),
  });
  const campos = data ?? [];
  const [arrastando, setArrastando] = useState<string | null>(null);

  async function adicionar() {
    if (!tenantId) return;
    const pergunta = "Nova pergunta";
    const base = chaveDaPergunta(pergunta);
    // A chave é única por requisito (`requisito_campos_requisito_id_chave_key`),
    // então "nova_pergunta" repetida quebraria no segundo clique.
    let chaveNova = base;
    let n = 2;
    const usadas = new Set(campos.map((c) => c.chave));
    while (usadas.has(chaveNova)) chaveNova = `${base}_${n++}`;
    try {
      await criarCampo(tenantId, requisitoId, {
        chave: chaveNova,
        pergunta,
        ordem: (campos.length + 1) * 10,
      });
      qc.invalidateQueries({ queryKey: chave });
      qc.invalidateQueries({ queryKey: ["requisitos"] });
    } catch {
      showToast("Não foi possível adicionar a pergunta", "error");
    }
  }

  async function soltar(destinoId: string) {
    if (!arrastando || arrastando === destinoId) return;
    const ids = campos.map((c) => c.id);
    const de = ids.indexOf(arrastando);
    const para = ids.indexOf(destinoId);
    if (de < 0 || para < 0) return;
    ids.splice(para, 0, ids.splice(de, 1)[0]);
    // Otimista: a lista reordena na hora e a gravação corre atrás.
    qc.setQueryData<CampoRequisito[]>(chave, (v) =>
      v ? ids.map((id) => v.find((c) => c.id === id)!).filter(Boolean) : v
    );
    setArrastando(null);
    try {
      await reordenarCampos(ids);
    } catch {
      showToast("Não foi possível salvar a ordem", "error");
    } finally {
      qc.invalidateQueries({ queryKey: chave });
    }
  }

  return (
    <div className="config-card">
      <div className="rq-cfg-topo">
        <p className="rq-cfg-explica">
          As perguntas, na ordem em que a cliente responde. Arraste para
          reordenar.
        </p>
        <button type="button" className="btn-ghost" onClick={adicionar}>
          <Plus size={14} strokeWidth={2} /> Pergunta
        </button>
      </div>

      {isPending ? (
        <p className="rq-cfg-vazio">Carregando…</p>
      ) : campos.length === 0 ? (
        <p className="rq-cfg-vazio">Nenhuma pergunta ainda.</p>
      ) : (
        <ul className="rq-cfg-perguntas">
          {campos.map((c) => (
            <LinhaPergunta
              key={c.id}
              campo={c}
              requisitoId={requisitoId}
              arrastando={arrastando === c.id}
              onArrastar={setArrastando}
              onSoltar={soltar}
              onMudou={() => {
                qc.invalidateQueries({ queryKey: chave });
                qc.invalidateQueries({ queryKey: ["requisitos"] });
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function LinhaPergunta({
  campo,
  requisitoId,
  arrastando,
  onArrastar,
  onSoltar,
  onMudou,
}: {
  campo: CampoRequisito;
  requisitoId: string;
  arrastando: boolean;
  onArrastar: (id: string | null) => void;
  onSoltar: (id: string) => void;
  onMudou: () => void;
}) {
  const [pergunta, setPergunta] = useState(campo.pergunta);
  const [chave, setChave] = useState(campo.chave);
  // A troca de chave fica PENDENTE até a confirmação: `usos` é quantas
  // respostas já gravadas usam a chave antiga.
  const [trocaPendente, setTrocaPendente] = useState<{
    nova: string;
    usos: number;
  } | null>(null);
  const [apagando, setApagando] = useState(false);

  useEffect(() => {
    setPergunta(campo.pergunta);
    setChave(campo.chave);
  }, [campo.pergunta, campo.chave]);

  async function salvar(campos: Parameters<typeof salvarCampo>[1]) {
    try {
      await salvarCampo(campo.id, campos);
      onMudou();
    } catch {
      showToast("Não foi possível salvar", "error");
    }
  }

  /**
   * ⚠️ TROCAR A CHAVE QUEBRA O HISTÓRICO. As respostas antigas guardam a chave
   * velha dentro do `jsonb`, e depois do renome não há mais como ligar uma
   * coisa à outra — a pergunta continua, mas o passado dela some.
   *
   * Por isso o aviso conta QUANTAS respostas já usam a chave antes de deixar
   * seguir. (`requisito_campos` não tem coluna `ativo`, então "desativar e
   * criar nova" ainda não é possível pelo painel — o caminho é criar a nova e
   * apagar a velha depois de exportar o histórico.)
   */
  async function confirmarChave() {
    const nova = limparChave(chave);
    if (!nova || nova === campo.chave) {
      setChave(campo.chave);
      return;
    }
    let usos = 0;
    try {
      usos = await contarRespostasComChave(requisitoId, campo.chave);
    } catch {
      // Não deu para contar: avisa mesmo assim, que é o lado seguro.
      usos = -1;
    }
    if (usos !== 0) {
      setTrocaPendente({ nova, usos });
      return;
    }
    salvar({ chave: nova });
  }

  return (
    <li
      className={`rq-cfg-pergunta${arrastando ? " arrastando" : ""}`}
      draggable
      onDragStart={() => onArrastar(campo.id)}
      onDragEnd={() => onArrastar(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onSoltar(campo.id);
      }}
    >
      <span className="rq-cfg-pega" aria-hidden="true">
        <GripVertical size={14} strokeWidth={2} />
      </span>

      <div className="rq-cfg-pergunta-corpo">
        <input
          className="form-input rq-cfg-texto"
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onBlur={() => pergunta.trim() && salvar({ pergunta: pergunta.trim() })}
          aria-label="Pergunta"
        />

        <div className="rq-cfg-linha">
          <label className="rq-cfg-mini">
            <span>Chave</span>
            <input
              className="form-input"
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              onBlur={confirmarChave}
              aria-label="Chave"
            />
          </label>

          <label className="rq-cfg-mini">
            <span>Tipo</span>
            <Segmentado
              valor={campo.tipo}
              onChange={(v) =>
                salvar({
                  tipo: v as TipoCampo,
                  // Fora de `sim_nao` o alerta não tem valor para comparar.
                  alerta_se: v === "sim_nao" ? campo.alerta_se : null,
                })
              }
              opcoes={TIPOS.map((t) => ({ valor: t, rotulo: ROTULO_TIPO[t] }))}
              rotulo="Tipo da pergunta"
            />
          </label>

          <label className="rq-cfg-mini">
            <span>Obrigatória</span>
            <Segmentado
              valor={campo.obrigatorio ? "sim" : "nao"}
              onChange={(v) => salvar({ obrigatorio: v === "sim" })}
              opcoes={[
                { valor: "sim", rotulo: "Sim" },
                { valor: "nao", rotulo: "Não" },
              ]}
              rotulo="Obrigatória"
            />
          </label>
        </div>

        {/* Só em `sim_nao`: em texto livre não há valor fixo para comparar. */}
        {campo.tipo === "sim_nao" && (
          <div className="rq-cfg-alerta">
            <label className="rq-cfg-mini">
              <span>Alertar se</span>
              <Segmentado
                valor={campo.alerta_se ?? "nunca"}
                onChange={(v) =>
                  salvar({ alerta_se: v === "nunca" ? null : v })
                }
                opcoes={[
                  { valor: "sim", rotulo: "Sim" },
                  { valor: "nao", rotulo: "Não" },
                  { valor: "nunca", rotulo: "Nunca" },
                ]}
                rotulo="Alertar se a resposta for"
              />
            </label>
            <p className="rq-cfg-dica">
              Quando a cliente responder esse valor, a equipe recebe um alerta
              antes do atendimento.
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        className="rq-cfg-apagar"
        aria-label={`Apagar a pergunta ${campo.pergunta}`}
        onClick={() => setApagando(true)}
      >
        <Trash2 size={14} strokeWidth={2} />
      </button>

      <Confirmar
        aberto={apagando}
        titulo={`Apagar a pergunta "${campo.pergunta}"?`}
        texto="Ela some do formulário. As respostas já gravadas continuam no histórico, mas ninguém mais vai responder a esta pergunta."
        rotuloAcao="Apagar"
        onConfirmar={async () => {
          setApagando(false);
          try {
            await removerCampo(campo.id);
            onMudou();
          } catch {
            showToast("Não foi possível apagar", "error");
          }
        }}
        onCancelar={() => setApagando(false)}
      />

      <Confirmar
        aberto={!!trocaPendente}
        titulo={`Trocar a chave "${campo.chave}" quebra o histórico`}
        texto={`${
          trocaPendente && trocaPendente.usos > 0
            ? `${trocaPendente.usos} resposta${trocaPendente.usos === 1 ? "" : "s"} já gravada${trocaPendente.usos === 1 ? "" : "s"}`
            : "Respostas já gravadas"
        } guardam a chave antiga dentro do JSON e deixarão de ser ligadas a esta pergunta. Prefira criar uma pergunta nova.`}
        rotuloAcao="Trocar assim mesmo"
        onConfirmar={() => {
          const nova = trocaPendente?.nova;
          setTrocaPendente(null);
          if (nova) salvar({ chave: nova });
        }}
        onCancelar={() => {
          setTrocaPendente(null);
          setChave(campo.chave);
        }}
      />
    </li>
  );
}
