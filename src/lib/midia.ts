// Regra pura da mídia das conversas — sem React, sem I/O.
//
// Mora aqui e não no componente porque `lib/conversa.ts` também precisa dela
// (para o preview do inbox), e lib importando de components inverte a camada.

/**
 * O texto que vale mostrar.
 *
 * Quando a mensagem tem mídia, o campo `conversas.mensagem` guarda um
 * PLACEHOLDER escrito pelo n8n — `[o cliente mandou uma foto]` — que existe
 * para o agente ter o que ler, não para a tela. No áudio o campo é a
 * transcrição, e essa sim é conteúdo.
 *
 * Se o placeholder escapar, ele aparece escrito em cima da própria foto.
 */
export function textoReal(texto?: string | null): string | null {
  const t = texto?.trim();
  if (!t) return null;
  // Colchete que ABRE no início e FECHA no fim: "preço [tabela] novo" é texto
  // de verdade que por acaso tem colchete, e não pode sumir.
  //
  // `[\s\S]` em vez da flag `s`: ela exige target es2018, que este projeto não
  // usa — e o placeholder pode ter quebra de linha no meio.
  return /^\[[\s\S]*\]$/.test(t) ? null : t;
}
