"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { Card, FichaShell } from "@/components/ficha/ficha-shell";
import { FichaRecebida, LinkInvalido } from "@/components/ficha/estados";
import { PERGUNTAS, parseRespostas, type ChaveBool } from "@/lib/ficha";
import type { FichaRespostas } from "@/types/db";

type Erros = Partial<Record<keyof FichaRespostas, string>>;
type Bools = Partial<Record<ChaveBool, boolean>>;

// Fases do envio. `invalida` e `recebida` são respostas do servidor a um token
// que deixou de ser válido enquanto a paciente preenchia.
type Fase =
  | { t: "form" }
  | { t: "enviando" }
  | { t: "sucesso"; dataAgendamento: string | null }
  | { t: "recebida" }
  | { t: "invalida" };

export function FichaForm({
  token,
  nomeInicial,
}: {
  token: string;
  nomeInicial: string;
}) {
  const [nome, setNome] = useState(nomeInicial);
  const [nascimento, setNascimento] = useState("");
  const [bools, setBools] = useState<Bools>({});
  const [detalhes, setDetalhes] = useState<Record<string, string>>({});
  const [erros, setErros] = useState<Erros>({});
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>({ t: "form" });

  if (fase.t === "invalida") return <LinkInvalido />;
  if (fase.t === "recebida") return <FichaRecebida dataAgendamento={null} />;
  if (fase.t === "sucesso") {
    return <FichaRecebida dataAgendamento={fase.dataAgendamento} nome={nome} />;
  }

  const enviando = fase.t === "enviando";

  function montarPayload() {
    const payload: Record<string, unknown> = {
      nome,
      data_nascimento: nascimento,
      ...bools,
    };
    for (const p of PERGUNTAS) {
      if (!p.detalhe || !bools[p.key]) continue;
      const bruto = detalhes[p.detalhe.key] ?? "";
      payload[p.detalhe.key] =
        p.detalhe.tipo === "number" ? Number(bruto) : bruto;
    }
    return payload;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErroEnvio(null);

    // Mesma função que o servidor roda — validação otimista, não autoritativa.
    const parsed = parseRespostas(montarPayload());
    if (!parsed.ok) {
      setErros(parsed.erros);
      const primeira = Object.keys(parsed.erros)[0];
      document
        .getElementById(`campo-${primeira}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErros({});
    setFase({ t: "enviando" });

    // Rede da cliente pode ser ruim: aborta em 20s pra não ficar preso em
    // "Enviando…" para sempre — vira o erro de conexão com opção de retentar.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);

    try {
      const res = await fetch(`/api/ficha/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: ctrl.signal,
      });

      if (res.ok) {
        const json = (await res.json()) as { dataAgendamento: string | null };
        setFase({ t: "sucesso", dataAgendamento: json.dataAgendamento });
        return;
      }
      if (res.status === 404) return setFase({ t: "invalida" });
      if (res.status === 409) return setFase({ t: "recebida" });
      if (res.status === 400) {
        const json = (await res.json()) as { erros?: Erros };
        setErros(json.erros ?? {});
        setFase({ t: "form" });
        setErroEnvio("Confira os campos destacados.");
        return;
      }
      throw new Error("falha");
    } catch {
      setFase({ t: "form" });
      setErroEnvio(
        "Não conseguimos enviar. Verifique sua conexão e tente novamente."
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return (
    <FichaShell>
      <div className="mb-6 text-center">
        <h2 className="font-[family-name:var(--font-cormorant)] text-[25px] font-medium leading-snug text-[var(--f-text)] sm:text-[28px]">
          Ficha de avaliação para seu procedimento a laser
        </h2>
        <p className="mx-auto mt-3 max-w-[440px] text-[14.5px] leading-relaxed text-[var(--f-text2)]">
          São algumas perguntas rápidas para garantir que o laser é seguro para
          você. Leva 2 minutinhos.
        </p>
      </div>

      <Card>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-7">
          <Campo id="campo-nome" label="Seu nome completo" erro={erros.nome}>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
              placeholder="Como podemos te chamar"
              className="w-full rounded-xl border border-[var(--f-border)] bg-[var(--f-surface)] px-4 py-3.5 text-[15px] text-[var(--f-text)] outline-none transition-colors placeholder:text-[var(--f-muted)] focus:border-[var(--f-accent)]"
            />
          </Campo>

          <Campo
            id="campo-data_nascimento"
            label="Data de nascimento"
            erro={erros.data_nascimento}
          >
            <input
              type="date"
              value={nascimento}
              onChange={(e) => setNascimento(e.target.value)}
              autoComplete="bday"
              className="w-full rounded-xl border border-[var(--f-border)] bg-[var(--f-surface)] px-4 py-3.5 text-[15px] text-[var(--f-text)] outline-none transition-colors focus:border-[var(--f-accent)]"
            />
          </Campo>

          <div className="h-px bg-[var(--f-border)]" />

          {PERGUNTAS.map((p) => {
            const valor = bools[p.key];
            const aberto = valor === true && Boolean(p.detalhe);
            return (
              <div key={p.key} className="flex flex-col gap-3">
                <div id={`campo-${p.key}`} className="scroll-mt-24">
                  <p className="text-[15px] leading-snug text-[var(--f-text)]">
                    {p.label}
                  </p>
                  <SimNao
                    nome={p.key}
                    valor={valor}
                    onChange={(v) => {
                      setBools((b) => ({ ...b, [p.key]: v }));
                      setErros((e) => ({ ...e, [p.key]: undefined }));
                    }}
                  />
                  {erros[p.key] && <MsgErro>{erros[p.key]}</MsgErro>}
                </div>

                {p.detalhe && (
                  <div className={`ficha-reveal${aberto ? " open" : ""}`}>
                    <div>
                      <div
                        id={`campo-${p.detalhe.key}`}
                        className="scroll-mt-24 pt-1"
                      >
                        <label className="mb-2 block text-[13px] font-medium text-[var(--f-text2)]">
                          {p.detalhe.label}
                        </label>
                        <input
                          type={p.detalhe.tipo === "number" ? "number" : "text"}
                          inputMode={
                            p.detalhe.tipo === "number" ? "numeric" : "text"
                          }
                          min={p.detalhe.tipo === "number" ? 0 : undefined}
                          placeholder={p.detalhe.placeholder}
                          // Fora da tela para leitores/tab quando escondido.
                          tabIndex={aberto ? 0 : -1}
                          aria-hidden={!aberto}
                          value={detalhes[p.detalhe.key] ?? ""}
                          onChange={(e) => {
                            const key = p.detalhe!.key;
                            setDetalhes((d) => ({ ...d, [key]: e.target.value }));
                            setErros((er) => ({ ...er, [key]: undefined }));
                          }}
                          className="w-full rounded-xl border border-[var(--f-border)] bg-[var(--f-surface)] px-4 py-3 text-[15px] text-[var(--f-text)] outline-none transition-colors placeholder:text-[var(--f-muted)] focus:border-[var(--f-accent)]"
                        />
                        {erros[p.detalhe.key] && (
                          <MsgErro>{erros[p.detalhe.key]}</MsgErro>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {erroEnvio && (
            <div className="flex items-start gap-2.5 rounded-xl border border-[var(--f-danger)]/25 bg-[var(--f-danger)]/[0.06] px-4 py-3">
              <TriangleAlert
                size={17}
                strokeWidth={1.8}
                className="mt-0.5 shrink-0 text-[var(--f-danger)]"
              />
              <p className="text-[13.5px] leading-relaxed text-[var(--f-danger)]">
                {erroEnvio}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--f-accent)] px-6 text-[15.5px] font-medium text-white transition-colors hover:bg-[var(--f-accent-dark)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {enviando ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Enviando…
              </>
            ) : (
              "Enviar ficha"
            )}
          </button>

          <p className="flex items-center justify-center gap-1.5 text-center text-[12px] text-[var(--f-muted)]">
            <ShieldCheck size={13} strokeWidth={1.6} />
            Suas informações são confidenciais e usadas só pela equipe clínica.
          </p>
        </form>
      </Card>
    </FichaShell>
  );
}

function Campo({
  id,
  label,
  erro,
  children,
}: {
  id: string;
  label: string;
  erro?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24">
      <label className="mb-2 block text-[13px] font-medium text-[var(--f-text2)]">
        {label}
      </label>
      {children}
      {erro && <MsgErro>{erro}</MsgErro>}
    </div>
  );
}

function MsgErro({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 text-[12.5px] text-[var(--f-danger)]">{children}</p>
  );
}

// Toggle sim/não com área de toque generosa (52px de altura).
function SimNao({
  nome,
  valor,
  onChange,
}: {
  nome: string;
  valor: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  const opcoes: ReadonlyArray<[boolean, string]> = [
    [true, "Sim"],
    [false, "Não"],
  ];
  return (
    <div className="mt-3 grid grid-cols-2 gap-2.5" role="group">
      {opcoes.map(([v, label]) => {
        const ativo = valor === v;
        return (
          <button
            key={label}
            type="button"
            name={nome}
            aria-pressed={ativo}
            onClick={() => onChange(v)}
            className={`min-h-[52px] rounded-xl border text-[15px] font-medium transition-colors ${
              ativo
                ? "border-[var(--f-accent)] bg-[var(--f-accent-light)] text-[var(--f-accent-dark)]"
                : "border-[var(--f-border)] bg-[var(--f-surface)] text-[var(--f-text2)] hover:border-[var(--f-accent)]/40"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
