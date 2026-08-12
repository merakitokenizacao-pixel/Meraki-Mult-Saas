"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Pause, Play, X } from "lucide-react";
import { textoReal } from "@/lib/midia";

// Foto e áudio dentro da conversa.
//
// O n8n grava o arquivo no bucket `midia-conversas` e põe o caminho em
// `conversas.media_path`. O campo `mensagem` guarda um PLACEHOLDER
// (`[o cliente mandou uma foto]`) ou, no áudio, a transcrição.

// A regra em si mora em `lib/midia.ts` — o preview do inbox usa a mesma, e
// lib importando de components inverteria a camada. Reexportado aqui porque o
// contrato de uso é este módulo.
export { textoReal };

// ── Assinatura em lote ────────────────────────────────────────────────
// O bucket é privado e cada arquivo precisa de URL assinada. Assinar por bolha
// faria uma conversa com 30 fotos disparar 30 requisições ao abrir; o provider
// pede o lote inteiro de uma vez.

const CtxMidia = createContext<{
  urls: Record<string, string>;
  carregando: boolean;
}>({ urls: {}, carregando: false });

export function MidiaProvider({
  caminhos,
  children,
}: {
  caminhos: string[];
  children: React.ReactNode;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(false);

  // A chave estabiliza o efeito: `caminhos` é array novo a cada render, e sem
  // isto o provider reassinaria tudo a cada tecla digitada no composer.
  const chave = useMemo(() => [...new Set(caminhos)].sort().join("|"), [caminhos]);

  useEffect(() => {
    const lista = chave ? chave.split("|") : [];
    // Só pede o que ainda não tem: rolar para trás no histórico acrescenta
    // caminhos, e reassinar os antigos junto seria trabalho repetido.
    const faltando = lista.filter((c) => !urls[c]);
    if (faltando.length === 0) return;

    let vivo = true;
    setCarregando(true);
    fetch("/api/painel/midia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caminhos: faltando }),
    })
      .then((r) => (r.ok ? r.json() : { urls: {} }))
      .then((j) => {
        if (vivo) setUrls((prev) => ({ ...prev, ...(j.urls ?? {}) }));
      })
      .catch(() => {
        /* sem URL a bolha mostra o estado de falha, não quebra a conversa */
      })
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
    // `urls` de propósito fora das deps: ele muda dentro do próprio efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return (
    <CtxMidia.Provider value={{ urls, carregando }}>
      {children}
    </CtxMidia.Provider>
  );
}

export interface MsgMidia {
  media_tipo?: string | null;
  media_path?: string | null;
  media_duracao?: number | null;
  texto?: string | null;
}

export function MidiaMensagem({ msg }: { msg: MsgMidia }) {
  const { urls } = useContext(CtxMidia);
  const url = msg.media_path ? urls[msg.media_path] : undefined;
  const legenda = textoReal(msg.texto);

  if (msg.media_tipo === "audio") {
    return <Audio url={url} duracaoBanco={msg.media_duracao} transcricao={legenda} />;
  }
  return <Imagem url={url} legenda={legenda} />;
}

// ── Imagem ────────────────────────────────────────────────────────────

function Imagem({ url, legenda }: { url?: string; legenda: string | null }) {
  const [aberto, setAberto] = useState(false);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", onKey);
    // Trava o scroll do fundo enquanto a foto está ampliada.
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = antes;
    };
  }, [aberto]);

  if (!url || falhou) {
    return (
      <div className="midia-falha">
        {falhou
          ? "A imagem expirou — recarregue a conversa"
          : "Carregando imagem…"}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="midia-thumb"
        onClick={() => setAberto(true)}
        aria-label="Ampliar imagem"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={legenda ?? "Imagem enviada"} onError={() => setFalhou(true)} />
      </button>
      {legenda && <div className="midia-legenda">{legenda}</div>}

      {aberto &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="midia-lightbox"
            role="dialog"
            aria-modal="true"
            onClick={() => setAberto(false)}
          >
            <button
              type="button"
              className="midia-lightbox-fechar"
              aria-label="Fechar"
              onClick={() => setAberto(false)}
            >
              <X size={20} strokeWidth={2} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={legenda ?? "Imagem enviada"}
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </>
  );
}

// ── Áudio ─────────────────────────────────────────────────────────────

const VELOCIDADES = [1, 1.5, 2] as const;

function mmss(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function Audio({
  url,
  duracaoBanco,
  transcricao,
}: {
  url?: string;
  duracaoBanco?: number | null;
  transcricao: string | null;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState<number>(duracaoBanco ?? 0);
  const [vel, setVel] = useState<number>(1);
  const [verTexto, setVerTexto] = useState(false);

  // O ogg/opus que o WhatsApp manda costuma vir SEM duração no cabeçalho, e o
  // navegador reporta Infinity. Nesse caso vale o que o n8n gravou no banco —
  // senão a barra fica sem fim e o tempo mostra "0:00" o áudio inteiro.
  const aoCarregar = useCallback(() => {
    const d = ref.current?.duration;
    if (d && Number.isFinite(d)) setDur(d);
    else if (duracaoBanco) setDur(duracaoBanco);
  }, [duracaoBanco]);

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = vel;
  }, [vel]);

  if (!url) return <div className="midia-falha">Carregando áudio…</div>;

  const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;

  return (
    <div className="midia-audio-wrap">
      <div className="midia-audio">
        <button
          type="button"
          className="midia-audio-play"
          aria-label={tocando ? "Pausar" : "Tocar"}
          onClick={() => {
            const a = ref.current;
            if (!a) return;
            if (a.paused) a.play();
            else a.pause();
          }}
        >
          {tocando ? <Pause size={14} strokeWidth={2} /> : <Play size={14} strokeWidth={2} />}
        </button>

        <div className="midia-audio-barra" aria-hidden="true">
          <div className="midia-audio-progresso" style={{ width: `${pct}%` }} />
        </div>

        <span className="midia-audio-tempo">
          {mmss(tocando || pos > 0 ? pos : dur)}
        </span>

        <button
          type="button"
          className="midia-audio-vel"
          onClick={() =>
            setVel((v) => VELOCIDADES[(VELOCIDADES.indexOf(v as 1) + 1) % VELOCIDADES.length])
          }
          aria-label="Velocidade de reprodução"
        >
          {vel}×
        </button>

        <audio
          ref={ref}
          src={url}
          preload="metadata"
          onLoadedMetadata={aoCarregar}
          onDurationChange={aoCarregar}
          onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
          onPlay={() => setTocando(true)}
          onPause={() => setTocando(false)}
          onEnded={() => {
            setTocando(false);
            setPos(0);
          }}
        />
      </div>

      {/* A transcrição vem colapsada: ela é longa e, aberta por padrão,
          empurraria o resto da conversa para fora da tela. */}
      {transcricao && (
        <>
          <button
            type="button"
            className="midia-audio-transcricao-btn"
            onClick={() => setVerTexto((v) => !v)}
            aria-expanded={verTexto}
          >
            <ChevronDown
              size={12}
              strokeWidth={2}
              style={{ transform: verTexto ? "rotate(180deg)" : undefined }}
            />
            {verTexto ? "ocultar transcrição" : "ver transcrição"}
          </button>
          {verTexto && <div className="midia-audio-transcricao">{transcricao}</div>}
        </>
      )}
    </div>
  );
}
