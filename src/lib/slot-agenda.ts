// Situação de um horário da agenda — lida do BANCO, não recalculada aqui.
//
// `agenda_checar` é a mesma função que as tools da Laura usam. Se o front
// fizesse a própria conta de capacidade, as duas divergiriam no primeiro
// bloqueio ou mudança de escala, e ninguém saberia qual está certa.

import { supabase } from "@/lib/supabase";
import {
  instanteDoSlot,
  type ChecagemSlot,
  type ProfissionalNaEscala,
} from "@/lib/slot-regras";

export interface SituacaoSlot {
  checagem: ChecagemSlot | null;
  escala: ProfissionalNaEscala[];
}

export async function getSituacaoSlot(
  dataStr: string,
  hora: number,
  duracaoMin = 60
): Promise<SituacaoSlot> {
  const p_inicio = instanteDoSlot(dataStr, hora);
  const [chk, esc] = await Promise.all([
    supabase.rpc("agenda_checar", { p_inicio, p_duracao_min: duracaoMin }),
    supabase.rpc("agenda_profissionais_na_escala", {
      p_inicio,
      p_duracao_min: duracaoMin,
    }),
  ]);
  if (chk.error) throw chk.error;
  if (esc.error) throw esc.error;

  // `agenda_checar` devolve TABLE, então vem como array de uma linha.
  const linha = Array.isArray(chk.data) ? chk.data[0] : chk.data;
  return {
    checagem: (linha as ChecagemSlot) ?? null,
    escala: (esc.data ?? []) as ProfissionalNaEscala[],
  };
}

// As regras puras moram em `slot-regras.ts` e são reexportadas aqui.
export {
  estadoDoSlot,
  instanteDoSlot,
  linhasDoSlot,
  marcadasNoSlot,
  marcadasSemDono,
  resumoSlot,
  type ChecagemSlot,
  type EstadoSlot,
  type LinhaProfissional,
  type ProfissionalNaEscala,
} from "@/lib/slot-regras";
