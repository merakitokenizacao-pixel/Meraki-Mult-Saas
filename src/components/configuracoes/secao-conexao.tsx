"use client";

import { useCallback, useEffect, useState } from "react";
import { QrCode, RefreshCw, Smartphone } from "lucide-react";

// Conexão do WhatsApp.
//
// Hoje a dona só descobre que o número caiu quando uma cliente reclama que
// ninguém respondeu — a Laura fica muda e nada na tela avisa. Esta seção
// pergunta o estado direto à Evolution e, se caiu, entrega o QR para reparear.

type Estado = "conectado" | "conectando" | "desconectado";

interface Status {
  estado: Estado;
  bruto: string;
  instancia: string;
}

const ROTULO: Record<Estado, { texto: string; classe: string }> = {
  conectado: { texto: "Conectado", classe: "ok" },
  conectando: { texto: "Aguardando leitura do QR", classe: "meio" },
  desconectado: { texto: "Desconectado", classe: "ruim" },
};

export function SecaoConexao() {
  const [status, setStatus] = useState<Status | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [qr, setQr] = useState<string | null>(null);
  const [pedindoQr, setPedindoQr] = useState(false);

  const consultar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch("/api/painel/conexao", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) {
        // "Não consegui perguntar" ≠ "está desconectado". Dizer que caiu sem
        // ter checado faria correr atrás de um problema que talvez não exista.
        setErro(j.erro ?? "Não foi possível consultar o WhatsApp");
        setStatus(null);
      } else {
        setStatus(j as Status);
        if (j.estado === "conectado") setQr(null);
      }
    } catch {
      setErro("Não foi possível consultar o WhatsApp");
      setStatus(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    consultar();
  }, [consultar]);

  // Enquanto o QR está na tela, reconsulta: assim a tela reage sozinha no
  // instante em que o celular lê o código, em vez de esperar um clique.
  useEffect(() => {
    if (!qr) return;
    const t = setInterval(consultar, 5000);
    return () => clearInterval(t);
  }, [qr, consultar]);

  async function pedirQr() {
    setPedindoQr(true);
    setErro(null);
    try {
      const r = await fetch("/api/painel/conexao", { method: "POST" });
      const j = await r.json();
      if (!r.ok) setErro(j.erro ?? "Não foi possível pedir o QR");
      else if (j.qr) setQr(j.qr);
      else
        setErro(
          "O WhatsApp não devolveu um QR agora. Se a conexão já estiver de pé, não há o que parear."
        );
    } catch {
      setErro("Não foi possível pedir o QR");
    } finally {
      setPedindoQr(false);
    }
  }

  const r = status ? ROTULO[status.estado] : null;

  return (
    <div className="config-card">
      <div className="conexao-topo">
        <Smartphone size={18} strokeWidth={1.6} />
        <div>
          <div className="conexao-titulo">WhatsApp da clínica</div>
          <div className="conexao-sub">
            {status ? (
              <>
                Instância <code>{status.instancia}</code>
              </>
            ) : (
              "Número pelo qual a Laura atende"
            )}
          </div>
        </div>
        <div className="conexao-acoes">
          {r && <span className={`conexao-selo ${r.classe}`}>{r.texto}</span>}
          <button
            type="button"
            className="btn-ghost"
            onClick={consultar}
            disabled={carregando}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={13} strokeWidth={1.8} />
            {carregando ? "Consultando…" : "Verificar"}
          </button>
        </div>
      </div>

      {erro && <p className="conexao-erro">{erro}</p>}

      {status?.estado === "conectado" && (
        <p className="conexao-nota">
          A Laura está recebendo e respondendo por este número.
        </p>
      )}

      {status && status.estado !== "conectado" && (
        <>
          <p className="conexao-nota">
            Enquanto estiver assim, <strong>ninguém é atendido</strong>: as
            mensagens não chegam e a Laura não responde.
          </p>
          {!qr ? (
            <button
              type="button"
              className="btn-primary"
              onClick={pedirQr}
              disabled={pedindoQr}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <QrCode size={14} strokeWidth={1.8} />
              {pedindoQr ? "Pedindo o código…" : "Reconectar"}
            </button>
          ) : (
            <div className="conexao-qr">
              {/* A Evolution devolve o QR já em base64; não há host externo
                  envolvido, então nada aqui depende de imagem remota. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code para conectar o WhatsApp" />
              <ol className="conexao-passos">
                <li>Abra o WhatsApp no celular da clínica</li>
                <li>
                  Toque em <strong>Aparelhos conectados</strong>
                </li>
                <li>
                  Toque em <strong>Conectar um aparelho</strong> e aponte para
                  este código
                </li>
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}
