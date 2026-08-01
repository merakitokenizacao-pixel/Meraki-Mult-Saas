"use client";

// Aviso sonoro de mensagem nova. Gerado pela Web Audio API — sem arquivo, sem
// requisição, sem asset para versionar.
//
// Duas notas curtas e ascendentes (Sol5 → Dó6), em volume baixo. Intervalo
// subindo lê como "chegou algo"; descendo leria como erro. E o volume importa:
// quem está no painel costuma estar de fone no meio de um atendimento.

const CHAVE_PREFERENCIA = "vorax-som-conversas";

let ctx: AudioContext | null = null;
let ultimoToque = 0;

/** Rajada de mensagens (a cliente manda 4 seguidas) deve soar UMA vez. */
const INTERVALO_MINIMO_MS = 1500;

function pegarContexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * O navegador só libera áudio depois de um gesto do usuário; antes disso o
 * contexto nasce "suspended" e o primeiro toque sairia mudo. Chamar isto num
 * clique qualquer da tela destrava — e é barato repetir.
 */
export function destravarSom(): void {
  const c = pegarContexto();
  if (c && c.state === "suspended") void c.resume();
}

export function tocarNotificacao(): void {
  const c = pegarContexto();
  if (!c) return;

  const agora = Date.now();
  if (agora - ultimoToque < INTERVALO_MINIMO_MS) return;
  ultimoToque = agora;

  try {
    if (c.state === "suspended") void c.resume();
    const t0 = c.currentTime;
    // [frequência, atraso em segundos]
    for (const [freq, atraso] of [
      [784.0, 0],
      [1046.5, 0.085],
    ] as const) {
      const osc = c.createOscillator();
      const ganho = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      // Envelope: sobe e desce em rampa. Sem isso, o corte seco vira um
      // "clique" audível na borda da nota.
      const inicio = t0 + atraso;
      ganho.gain.setValueAtTime(0.0001, inicio);
      ganho.gain.exponentialRampToValueAtTime(0.12, inicio + 0.012);
      ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.22);
      osc.connect(ganho).connect(c.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.24);
    }
  } catch {
    /* áudio bloqueado ou indisponível: silêncio, nunca quebrar a tela */
  }
}

export function lerPreferenciaSom(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(CHAVE_PREFERENCIA) !== "0";
  } catch {
    return true;
  }
}

export function gravarPreferenciaSom(ligado: boolean): void {
  try {
    localStorage.setItem(CHAVE_PREFERENCIA, ligado ? "1" : "0");
  } catch {
    /* modo privativo: a preferência vale só nesta aba */
  }
}
