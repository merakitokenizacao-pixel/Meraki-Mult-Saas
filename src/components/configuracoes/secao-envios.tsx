"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/tenant-provider";
import { showToast } from "@/lib/toast";
import {
  DIAS,
  ROTULO_ENVIO,
  emUnidade,
  hhmm,
  previa,
  type RegraEnvio,
  type TipoEnvio,
} from "@/lib/envios";
import { listarRegras, salvarRegra } from "@/lib/envios-db";

// Onde a clínica define quando o sistema pode falar sozinho.
//
// ⚠️ UM PORTEIRO SÓ. Toda mensagem automática passa por `envio_pode`, e essa
// função não tem regra dentro — lê tudo daqui. No sistema anterior cada rotina
// tinha a própria regra, ou nenhuma, e uma cliente com 34 agendamentos recebeu
// 7 mensagens num dia.
//
// Autosave por campo, como na grade de "Quem faz o quê": são dezesseis campos
// por tipo, quatro tipos, e um botão "Salvar" no fim disso ninguém encontra.

const CHAVE = ["envios-regras"];

export function SecaoEnvios() {
  const { atual: clinica } = useTenant();
  const tenantId = clinica?.tenant_id ?? null;

  const { data, isPending, error } = useQuery({
    queryKey: [...CHAVE, tenantId],
    queryFn: () => listarRegras(tenantId!),
    enabled: !!tenantId,
  });

  if (isPending || !tenantId) {
    return <div className="config-card env-vazio">Carregando…</div>;
  }
  if (error) {
    return <div className="config-card env-vazio">Não foi possível carregar.</div>;
  }

  return (
    <div className="env-lista">
      <p className="env-intro">
        Toda mensagem que o sistema manda sozinho passa por estas regras. Os
        quatro tipos já vêm com um padrão recomendado — clínica nova funciona
        sem configurar nada.
      </p>
      {(data ?? []).map((r) => (
        <CardEnvio key={r.tipo} regra={r} tenantId={tenantId} />
      ))}
    </div>
  );
}

function CardEnvio({
  regra,
  tenantId,
}: {
  regra: RegraEnvio;
  tenantId: string;
}) {
  const qc = useQueryClient();
  // Cópia local para o autosave ser otimista: o campo muda na hora e a
  // gravação corre atrás. Se falhar, o refetch traz o valor do banco de volta.
  const [r, setR] = useState(regra);
  useEffect(() => setR(regra), [regra]);

  const rotulo = ROTULO_ENVIO[regra.tipo];

  async function salvar(campos: Partial<Omit<RegraEnvio, "tipo">>) {
    setR((v) => ({ ...v, ...campos }));
    try {
      await salvarRegra(tenantId, regra.tipo, campos);
      qc.invalidateQueries({ queryKey: CHAVE });
    } catch {
      setR(regra);
      showToast("Não foi possível salvar", "error");
    }
  }

  function alternarDia(d: number) {
    const tem = r.dias_semana.includes(d);
    const dias = tem
      ? r.dias_semana.filter((x) => x !== d)
      : [...r.dias_semana, d].sort((a, b) => a - b);
    salvar({ dias_semana: dias });
  }

  return (
    <section className={`config-card env-card${r.ativo ? "" : " desligado"}`}>
      <header className="env-topo">
        <div>
          <h2 className="env-nome">{rotulo.nome}</h2>
          <p className="env-quando">{rotulo.quando}</p>
        </div>
        <label className="env-chave">
          <input
            type="checkbox"
            checked={r.ativo}
            onChange={(e) => salvar({ ativo: e.target.checked })}
          />
          <span>{r.ativo ? "Ativo" : "Desligado"}</span>
        </label>
      </header>

      {r.ativo && (
        <div className="env-campos">
          {/* ── Quando manda ── */}
          <div className="env-grupo">
            <h3 className="env-grupo-titulo">Quando manda</h3>
            <div className="env-linha">
              {regra.tipo === "lembrete" ? (
                <label className="env-campo">
                  <span className="env-rotulo">Antecedência (horas)</span>
                  <input
                    type="number"
                    min={0}
                    className="form-input env-num"
                    value={r.antecedencia_horas ?? ""}
                    onChange={(e) =>
                      setR({
                        ...r,
                        antecedencia_horas: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    onBlur={() =>
                      salvar({ antecedencia_horas: r.antecedencia_horas })
                    }
                  />
                  <span className="env-dica">
                    {emUnidade(r.antecedencia_horas)} antes do atendimento
                  </span>
                </label>
              ) : (
                <label className="env-campo">
                  <span className="env-rotulo">Atraso (horas)</span>
                  <input
                    type="number"
                    min={0}
                    className="form-input env-num"
                    value={r.atraso_horas ?? ""}
                    onChange={(e) =>
                      setR({
                        ...r,
                        atraso_horas: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    onBlur={() => salvar({ atraso_horas: r.atraso_horas })}
                  />
                  <span className="env-dica">
                    {emUnidade(r.atraso_horas)} depois da última mensagem
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* ── Horário permitido ── */}
          <div className="env-grupo">
            <h3 className="env-grupo-titulo">Horário permitido</h3>
            <div className="env-linha">
              <label className="env-campo">
                <span className="env-rotulo">Das</span>
                <input
                  type="time"
                  className="form-input env-hora"
                  value={hhmm(r.janela_inicio)}
                  onChange={(e) => salvar({ janela_inicio: e.target.value })}
                />
              </label>
              <label className="env-campo">
                <span className="env-rotulo">Até</span>
                <input
                  type="time"
                  className="form-input env-hora"
                  value={hhmm(r.janela_fim)}
                  onChange={(e) => salvar({ janela_fim: e.target.value })}
                />
              </label>
            </div>
            <div className="env-campo">
              <span className="env-rotulo">Dias da semana</span>
              {/* ⚠️ Domingo = 0, como `extract(dow)` no Postgres — é assim que
                  `envio_pode` compara. Trocar a origem aqui deslocaria a semana
                  inteira sem erro nenhum. */}
              <div className="env-dias" role="group" aria-label="Dias da semana">
                {DIAS.map(([n, letra]) => {
                  const on = r.dias_semana.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      className={`env-dia${on ? " marcado" : ""}`}
                      aria-pressed={on}
                      aria-label={
                        ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][n]
                      }
                      onClick={() => alternarDia(n)}
                    >
                      {letra}
                    </button>
                  );
                })}
              </div>
              <span className="env-dica">
                Fora desse horário, a mensagem espera a próxima janela.
              </span>
            </div>
          </div>

          {/* ── Limites ── */}
          <div className="env-grupo">
            <h3 className="env-grupo-titulo">Limites</h3>
            <div className="env-linha">
              <NumeroCampo
                rotulo="Carência após agendar (horas)"
                valor={r.min_horas_apos_criacao}
                onSalvar={(v) => salvar({ min_horas_apos_criacao: v })}
                dica="Quem acabou de agendar não recebe lembrete logo em seguida."
              />
              <NumeroCampo
                rotulo="Máximo por pessoa por dia"
                valor={r.max_por_lead_dia}
                onSalvar={(v) => salvar({ max_por_lead_dia: v })}
                // O menos óbvio e o mais importante: é teto de MENSAGENS.
                dica="Se a cliente tem vários horários no mesmo dia, ela recebe UMA mensagem com todos. Este número é o teto de mensagens, não de horários."
              />
            </div>
            <div className="env-linha">
              <NumeroCampo
                rotulo="Máximo no período"
                valor={r.max_por_lead_periodo}
                onSalvar={(v) => salvar({ max_por_lead_periodo: v })}
              />
              <NumeroCampo
                rotulo="Período (dias)"
                valor={r.periodo_dias}
                onSalvar={(v) => salvar({ periodo_dias: v })}
              />
            </div>
          </div>

          {/* ── Quem não recebe ── */}
          <div className="env-grupo">
            <h3 className="env-grupo-titulo">Quem não recebe</h3>
            <label className="env-marca">
              <input
                type="checkbox"
                checked={r.respeita_pausa}
                onChange={(e) => salvar({ respeita_pausa: e.target.checked })}
              />
              <span>Quando alguém da equipe assumiu a conversa</span>
            </label>
            <label className="env-marca">
              <input
                type="checkbox"
                checked={r.respeita_optout}
                onChange={(e) => salvar({ respeita_optout: e.target.checked })}
              />
              <span>Quando a cliente pediu para não receber</span>
            </label>
            <label className="env-marca">
              <input
                type="checkbox"
                checked={r.pular_se_frequente}
                onChange={(e) => salvar({ pular_se_frequente: e.target.checked })}
              />
              <span>Quem já vem com frequência</span>
            </label>

            {/* Só aparece quando o interruptor está ligado: dois campos que não
                fazem nada é pior que dois campos ausentes. */}
            {r.pular_se_frequente && (
              <div className="env-frequente">
                <div className="env-linha">
                  <NumeroCampo
                    rotulo="Atendimentos"
                    valor={r.frequente_min_visitas}
                    onSalvar={(v) => salvar({ frequente_min_visitas: v })}
                  />
                  <NumeroCampo
                    rotulo="Nos últimos (dias)"
                    valor={r.frequente_dias}
                    onSalvar={(v) => salvar({ frequente_dias: v })}
                  />
                </div>
                <span className="env-dica">
                  Não avisar quem teve {r.frequente_min_visitas} ou mais
                  atendimentos nos últimos {r.frequente_dias} dias.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ⚠️ A PRÉVIA É O CONTROLE DE VERDADE DESTA TELA. Dezesseis campos e um
          array não dizem o que vai acontecer; a mesma regra em português a dona
          lê e diz na hora se está certa. */}
      <p className="env-previa">{previa(r)}</p>
    </section>
  );
}

function NumeroCampo({
  rotulo,
  valor,
  onSalvar,
  dica,
}: {
  rotulo: string;
  valor: number;
  onSalvar: (v: number) => void;
  dica?: string;
}) {
  const [v, setV] = useState(String(valor));
  useEffect(() => setV(String(valor)), [valor]);
  return (
    <label className="env-campo">
      <span className="env-rotulo">{rotulo}</span>
      <input
        type="number"
        min={0}
        className="form-input env-num"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 0 && n !== valor) onSalvar(n);
          else setV(String(valor));
        }}
      />
      {dica && <span className="env-dica">{dica}</span>}
    </label>
  );
}

// ── Dispensa individual, usada na ficha do cliente ──────────────────────────

/**
 * O override manual. A regra automática pega o caso comum; a dona conhece a
 * exceção que o número não pega — e `envio_pode` checa a dispensa ANTES de
 * pausa, opt-out e frequência. Manual sempre vence.
 */
export function DispensaEnvios({
  valor,
  onMudar,
}: {
  valor: string[];
  onMudar: (tipos: TipoEnvio[]) => void;
}) {
  const marcados = new Set(valor);
  return (
    <div className="env-dispensa">
      {(Object.keys(ROTULO_ENVIO) as TipoEnvio[]).map((t) => (
        <label key={t} className="env-marca">
          <input
            type="checkbox"
            checked={marcados.has(t)}
            onChange={(e) => {
              const n = new Set(marcados);
              if (e.target.checked) n.add(t);
              else n.delete(t);
              onMudar([...n] as TipoEnvio[]);
            }}
          />
          <span>{ROTULO_ENVIO[t].nome}</span>
        </label>
      ))}
    </div>
  );
}
