// Números da LINS exibidos na seção "Nº 001".
//
// FICAM AQUI, num arquivo só, com a data da apuração ao lado — porque número
// em página de venda envelhece calado. Sem a data, "2.400 mensagens" continua
// na tela em 2027 parecendo atual.
//
// ⚠️ NÃO PREENCHER POR CONTA PRÓPRIA. Estimar, arredondar para cima ou inventar
// percentual de satisfação é o tipo de coisa que uma dona de clínica confere em
// trinta segundos — e quando não fecha, ela para de acreditar no resto da
// página junto. O Meraki preenche.
//
// Enquanto `valor` estiver vazio, a linha NÃO É RENDERIZADA: melhor a seção
// com dois números verdadeiros do que quatro, sendo dois chutados.

export interface NumeroLins {
  valor: string;
  rotulo: string;
}

/** Mês/ano da apuração, mostrado na página. Vazio esconde a seção inteira. */
export const APURACAO = "";

export const NUMEROS: NumeroLins[] = [
  { valor: "", rotulo: "mensagens respondidas" },
  { valor: "", rotulo: "agendamentos pela Laura" },
  { valor: "", rotulo: "clientes na base" },
  { valor: "", rotulo: "no ar desde" },
];

export const NUMEROS_PREENCHIDOS = NUMEROS.filter((n) => n.valor.trim());
