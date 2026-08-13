// Bloqueio de horário — camada de dados compartilhada.
//
// A dona bloqueava horário criando um agendamento falso no próprio nome. Não
// era gambiarra: não existia outro caminho na tela. Mas aquilo cai em
// `agendamentos` e sobe contagem de atendimento, conversão e receita.
//
// `profissional_bloqueios` já é respeitada por `agenda_profissionais_na_escala`,
// que exclui da escala quem tem bloqueio sobrepondo a janela. Gravar aqui já
// derruba a capacidade e já faz o horário sumir para a Laura — nada de backend
// muda. E como bloqueio não encosta em `agendamentos`, nenhuma métrica precisa
// de filtro novo. É por isso que o caminho é este, e não um
// `status = 'bloqueio'`.

import { supabase } from "@/lib/supabase";
import type { Bloqueio } from "@/lib/bloqueio-regras";

export interface NovoBloqueio {
  profissional_id: string;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  motivo: string | null;
}

/** Bloqueios de um intervalo de dias. Recebe as pontas já em "YYYY-MM-DD"
 *  local — nunca `toISOString()`, que converte para UTC e às 21h de Brasília
 *  devolve o dia seguinte. */
export async function getBloqueiosNoPeriodo(
  de: string,
  ate: string
): Promise<Bloqueio[]> {
  const { data, error } = await supabase
    .from("profissional_bloqueios")
    .select("id,profissional_id,data,hora_inicio,hora_fim,motivo")
    .gte("data", de)
    .lte("data", ate)
    .order("data")
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as Bloqueio[];
}

export async function criarBloqueios(linhas: NovoBloqueio[]): Promise<void> {
  if (linhas.length === 0) return;
  // "Todas" grava UMA LINHA POR PROFISSIONAL, não uma linha com
  // `profissional_id` nulo: a coluna é NOT NULL e a função do banco casa por
  // id. Uma linha nula não bloquearia ninguém.
  const { error } = await supabase.from("profissional_bloqueios").insert(linhas);
  if (error) throw error;
}

export async function removerBloqueio(id: string): Promise<void> {
  const { error } = await supabase
    .from("profissional_bloqueios")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// As regras puras moram em `bloqueio-regras.ts` e são reexportadas aqui: quem
// consome a tela importa de um lugar só.
export {
  conflitosNoPeriodo,
  type Bloqueio,
  faixasSobrepoem,
  minutosDe,
  rotuloBloqueio,
  type ConflitoAgendamento,
} from "@/lib/bloqueio-regras";
