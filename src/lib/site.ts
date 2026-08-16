// Constantes do site institucional (rota `/`). Nada aqui toca o CRM.

/**
 * WhatsApp comercial. Formato do wa.me: só dígitos, país + DDD + número.
 *
 * ⚠️ O número informado (+55 61 9879-1499) tem 8 dígitos locais. Celular no
 * Brasil tem 9 (começa com 9), então assumi o nono dígito → 61 99879-1499.
 * Se na verdade for um fixo com WhatsApp Business, troque para
 * "556198791499" (sem o 9 extra). CONFERIR clicando no CTA.
 */
const WHATSAPP_NUMERO = "5561998791499";

export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
  "Olá! Quero a Laura na minha clínica."
)}`;

/** PLACEHOLDER — e-mail comercial exibido no rodapé. */
export const EMAIL_CONTATO = "contato@vorax.solutions";

export const CTA_LABEL = "Quero a Laura na minha clínica";

/** Versão curta para a pílula do header (o rótulo longo não cabe). */
export const CTA_CURTO = "Quero a Laura";

/**
 * Imagem de atmosfera do hero. `null` = usa o tratamento em CSS (gradiente
 * quente + grain + vinheta), que é o padrão hoje.
 *
 * Para usar uma foto: coloque o arquivo em `public/` e aponte aqui, ex.:
 *   export const HERO_IMAGEM = "/hero.jpg";
 *
 * O que funciona: luz natural atravessando cortina/persiana/folhagem sobre
 * superfície clara; tecido com luz lateral; água com ondulação. Tons quentes,
 * pouco contraste de cor, subexposta — ela é ATMOSFERA, não protagonista.
 * O que NÃO funciona: consultório, equipamento, pessoa posando, "rede neural".
 */
export const HERO_IMAGEM: string | null = null;

/** Metadados editoriais do canto do hero (estilo capa de revista). */
export const HERO_META = ["Brasília · Brasil", "MMXXVI", "Atendimento autônomo"] as const;

// Sem menu de âncoras no header, de propósito: a referência mantém o topo com
// só três elementos (Entrar · marca · CTA), e é isso que o faz respirar.
// A navegação da página é a própria rolagem.

/**
 * Identificação legal, exibida no rodapé.
 *
 * ⚠️ VAZIAS de propósito — o Meraki preenche. Enquanto estiverem vazias a
 * linha simplesmente não é renderizada, o que é melhor que um CNPJ inventado
 * num site que vende software para clínica.
 */
export const RAZAO_SOCIAL = "";
export const CNPJ = "";
