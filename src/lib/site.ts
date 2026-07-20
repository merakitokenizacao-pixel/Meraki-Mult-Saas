// Constantes do site institucional (rota `/`). Nada aqui toca o CRM.

/**
 * PLACEHOLDER — trocar pelo link real do WhatsApp comercial.
 * Formato: https://wa.me/55DDDNUMERO?text=mensagem%20pré-preenchida
 */
export const WHATSAPP_URL =
  "https://wa.me/5561000000000?text=Ol%C3%A1!%20Quero%20a%20Laura%20na%20minha%20cl%C3%ADnica.";

/** PLACEHOLDER — e-mail comercial exibido no rodapé. */
export const EMAIL_CONTATO = "contato@vorax.solutions";

export const CTA_LABEL = "Quero a Laura na minha clínica";

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

export const SECOES = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#recursos", label: "Recursos" },
  { href: "#confianca", label: "Por que confiar" },
] as const;
