"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Smartphone } from "lucide-react";
import Image from "next/image";
import { fetchPainel } from "@/lib/api-painel";
import { useTenant } from "@/components/tenant-provider";
import { Confirmar } from "@/components/confirmar";
import { showToast } from "@/lib/toast";
import { fmtDate } from "@/lib/format";
import { salvarAgenteAtivo } from "@/lib/agente-db";

// Conectar o WhatsApp da clínica, sozinha — e escolher se a agente responde.
//
// ⚠️ O PAINEL LÊ O BANCO, NÃO A EVOLUTION. A rota pergunta à Evolution, grava
// com `canal_estado()` e devolve o que ficou gravado. Sem isso o estado viveria
// só na memória do provedor: um F5 no meio do pareamento mostraria outra coisa.

interface Conexao {
  identificador: string | null;
  numero: string | null;
  status: string | null;
  conectado_em: string | null;
  ultimo_erro: string | null;
  slug: string;
}

/** O QR da Evolution vive ~60s. Depois disso ele não pareia mais nada, e
 *  deixar a pessoa mirando a câmera num código morto é o pior desfecho. */
const VIDA_DO_QR_MS = 60_000;
const INTERVALO_MS = 3_000;
const LIMITE_MS = 120_000;

function telefoneBonito(n: string | null): string {
  if (!n) return "";
  const d = n.replace(/\D/g, "").replace(/^55/, "");
  if (d.length < 10) return n;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  const meio = resto.length > 8 ? resto.slice(0, 5) : resto.slice(0, 4);
  return `+55 ${ddd} ${meio}-${resto.slice(-4)}`;
}

export function SecaoConexao() {
  const { agente, agenteAtivo, tenantId, recarregarAgente } = useTenant();
  const [conexao, setConexao] = useState<Conexao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [qrEm, setQrEm] = useState<number>(0);
  const [expirado, setExpirado] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const inicioRef = useRef(0);

  const consultar = useCallback(async () => {
    try {
      const r = await fetchPainel("/api/painel/conexao", { cache: "no-store" });
      const j = (await r.json()) as { conexao?: Conexao; erro?: string };
      if (!r.ok) throw new Error(j.erro ?? "Não foi possível consultar");
      setConexao(j.conexao ?? null);
      setErro(null);
      return j.conexao ?? null;
    } catch (e) {
      setErro((e as Error).message);
      return null;
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    consultar();
  }, [consultar]);

  const conectado = conexao?.status === "conectado";
  const pareando = !!qr && !conectado;

  // Enquanto o QR está na tela: consulta a cada 3s, desiste em 2 minutos.
  useEffect(() => {
    if (!pareando) return;
    const t = setInterval(async () => {
      const c = await consultar();
      if (c?.status === "conectado") {
        setQr(null);
        showToast("WhatsApp conectado", "success");
        return;
      }
      if (Date.now() - qrEm > VIDA_DO_QR_MS) setExpirado(true);
      if (Date.now() - inicioRef.current > LIMITE_MS) {
        setQr(null);
        setExpirado(true);
      }
    }, INTERVALO_MS);
    return () => clearInterval(t);
  }, [pareando, qrEm, consultar]);

  async function conectar() {
    setConectando(true);
    setExpirado(false);
    setErro(null);
    try {
      const r = await fetchPainel("/api/painel/conexao", { method: "POST" });
      const j = (await r.json()) as {
        qr?: string | null;
        conexao?: Conexao;
        erro?: string;
        aviso?: string | null;
      };
      if (!r.ok) throw new Error(j.erro ?? "Não foi possível conectar");
      setConexao(j.conexao ?? null);
      setQr(j.qr ?? null);
      setQrEm(Date.now());
      inicioRef.current = Date.now();
      if (j.aviso) showToast(j.aviso, "error");
      if (!j.qr && j.conexao?.status !== "conectado") {
        setErro("O WhatsApp não devolveu o código. Tente de novo.");
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setConectando(false);
    }
  }

  async function desconectar() {
    setDesconectando(false);
    try {
      const r = await fetchPainel("/api/painel/conexao", { method: "DELETE" });
      const j = (await r.json()) as { conexao?: Conexao; erro?: string };
      if (!r.ok) throw new Error(j.erro ?? "Não foi possível desconectar");
      setConexao(j.conexao ?? null);
      setQr(null);
      showToast("WhatsApp desconectado", "info");
    } catch (e) {
      showToast((e as Error).message, "error");
    }
  }

  return (
    <div className="cx-lista">
      <section className="config-card">
        {carregando ? (
          <p className="cx-vazio">Carregando…</p>
        ) : conectado ? (
          <>
            <div className="cx-linha">
              <span className="cx-marca ok" aria-hidden="true">
                <CheckCircle2 size={16} strokeWidth={2} />
              </span>
              <div>
                <p className="cx-titulo ok">Conectado</p>
                <p className="cx-numero">{telefoneBonito(conexao?.numero ?? null)}</p>
                {conexao?.conectado_em && (
                  <p className="cx-desde">desde {fmtDate(conexao.conectado_em)}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost cx-acao"
              onClick={() => setDesconectando(true)}
            >
              Desconectar
            </button>
          </>
        ) : pareando ? (
          <div className="cx-parear">
            {expirado ? (
              <>
                <p className="cx-titulo">O código expirou</p>
                <p className="cx-passo">
                  Ele vale cerca de um minuto. Gere outro e aponte a câmera.
                </p>
                <button
                  type="button"
                  className="btn-primary cx-acao"
                  onClick={conectar}
                  disabled={conectando}
                >
                  <RefreshCw size={14} strokeWidth={2} /> Gerar outro código
                </button>
              </>
            ) : (
              <>
                {/* 280px: menor que isso a câmera do celular erra a leitura
                    com frequência, e a pessoa acha que o código está quebrado. */}
                <Image
                  src={qr!}
                  alt="Código QR para conectar o WhatsApp"
                  width={280}
                  height={280}
                  unoptimized
                  className="cx-qr"
                />
                <ol className="cx-passos">
                  <li>Abra o WhatsApp no celular</li>
                  <li>Toque em Aparelhos conectados</li>
                  <li>Aponte a câmera para este código</li>
                </ol>
                <p className="cx-esperando">
                  <Loader2 size={13} className="cx-girando" /> esperando a leitura…
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="cx-linha">
              <span className="cx-marca" aria-hidden="true">
                <Smartphone size={16} strokeWidth={1.8} />
              </span>
              <div>
                <p className="cx-titulo">WhatsApp não conectado</p>
                <p className="cx-explica">
                  {agente} e o painel usam este número para conversar com suas
                  clientes.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-primary cx-acao"
              onClick={conectar}
              disabled={conectando}
            >
              {conectando ? "Conectando…" : "Conectar WhatsApp"}
            </button>
          </>
        )}

        {(erro || conexao?.ultimo_erro) && (
          <p className="cx-erro">{erro ?? conexao?.ultimo_erro}</p>
        )}
      </section>

      {/* ── O interruptor da agente ─────────────────────────────────────── */}
      <section className="config-card">
        <h2 className="cx-agente-nome">{agente}</h2>
        <button
          type="button"
          role="switch"
          aria-checked={agenteAtivo}
          aria-label={`${agente} responde automaticamente`}
          className={`env-toggle${agenteAtivo ? " ligado" : ""} cx-agente-toggle`}
          onClick={async () => {
            if (!tenantId) return;
            try {
              await salvarAgenteAtivo(tenantId, !agenteAtivo);
              await recarregarAgente();
            } catch {
              showToast("Não foi possível salvar", "error");
            }
          }}
        >
          <span className="env-toggle-trilho" aria-hidden="true">
            <span className="env-toggle-bolinha" />
          </span>
          <span className="env-toggle-rotulo">Responder automaticamente</span>
        </button>

        {/* ⚠️ O TEXTO DO DESLIGADO É O QUE IMPORTA AQUI. Sem ele, a clínica que
            não quer IA acha que o produto NÃO TEM o que ela desligou — e o que
            ela precisa entender é que está escolhendo, não abrindo mão. */}
        <p className="cx-agente-texto">
          <strong>Ligado:</strong> {agente} responde suas clientes no WhatsApp,
          consulta a agenda e marca.
        </p>
        <p className="cx-agente-texto">
          <strong>Desligado:</strong> as mensagens continuam chegando e ficando
          registradas, a agenda e os relatórios continuam funcionando — só que
          quem responde é você, pelo painel.
        </p>
      </section>

      <Confirmar
        aberto={desconectando}
        titulo="Desconectar o WhatsApp?"
        texto="Suas clientes param de receber e enviar mensagens até você conectar de novo."
        rotuloAcao="Desconectar"
        onConfirmar={desconectar}
        onCancelar={() => setDesconectando(false)}
      />
    </div>
  );
}
