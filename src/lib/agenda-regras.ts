// Apresentação dos códigos de disponibilidade que o BANCO devolve.
//
// ATENÇÃO — este arquivo NÃO tem mais regra de capacidade nenhuma.
// A grade de horários da clínica (quem atende, quando, quantas) é DERIVADA das
// profissionais e da escala delas, e vive só no Postgres:
//
//   profissionais + profissional_horarios + profissional_bloqueios
//        ↓
//   agenda_slots(de, ate) / agenda_checar(inicio, duracao)
//        ↓
//   CRM (esta grade) · trigger de proteção · tools da Laura (n8n)
//
// Antes, as regras estavam hardcoded aqui em TypeScript — o que fazia o CRM e
// a Laura terem DUAS fontes de verdade que divergiam (ela oferecia segunda de
// manhã, que a dona passa na pós-graduação; e recusava a 2ª/3ª vaga da tarde,
// que existem). O `agenda_capacidade_legado` no SQL preserva aquele
// comportamento como fallback, para o caso de a escala estar vazia.
//
// Vocabulário dos códigos: ver AGENTE.md.

/** Rótulo curto para escrever DENTRO da célula (o motivo completo vai no title). */
export function rotuloDoCodigo(codigo: string): string {
  switch (codigo) {
    case "FECHADO_DOMINGO":
      return "Fechado";
    case "SABADO_SO_DE_MANHA":
      return "Só de manhã";
    case "ALMOCO_REPASSAR_HUMANO":
      return "Almoço";
    case "FORA_DO_HORARIO_08_19":
      return "Fechado";
    case "HORARIO_INDISPONIVEL":
      return "Indisponível";
    default:
      return "Fechado";
  }
}
