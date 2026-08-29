import { NextResponse } from "next/server";
import { getSupabaseServer, getUsuario } from "@/lib/supabase-server";
import { resolverTenant, respostaErroTenant } from "@/lib/tenant-server";
import {
  tokenDaColuna,
  type CartaoKanban,
  type ColunaKanban,
  type PainelKanban,
  type TaxaNoShow,
} from "@/lib/kanban";

export const dynamic = "force-dynamic";

// ⚠️ POR QUE ESTA ROTA EXISTE, e não um `supabase.rpc()` no componente:
//
// `kanban`, `kanban_mover` e `taxa_no_show` são SECURITY DEFINER, recebem
// `p_tenant uuid` cru e NÃO chamam `tenant_valido()`. Estão concedidas a
// `authenticated`. Chamadas do navegador, qualquer conta logada leria — e, com
// `kanban_mover`, ESCREVERIA — na agenda de qualquer clínica do Meraki,
// bastando trocar um uuid no console.
//
// Aqui o tenant vem de `resolverTenant()`, que passa por `tenant_valido()` no
// banco. Só depois disso o uuid entra na RPC. Nenhuma chamada usa
// `service_role`: o cliente de sessão basta, e a RLS continua valendo para
// tudo que não é SECURITY DEFINER.

/** Linha crua devolvida por `kanban()` — uma por (coluna × agendamento). */
interface LinhaKanban {
  status: string;
  rotulo: string;
  cor: string | null;
  ordem: number;
  agendamento_id: string | null;
  lead_id: string | null;
  quem: string | null;
  telefone: string | null;
  servico: string | null;
  profissional: string | null;
  quando: string | null;
  duracao_min: number | null;
  lembrete_enviado: boolean | null;
  atrasado: boolean | null;
}

const TAXA_VAZIA: TaxaNoShow = {
  realizados: 0,
  faltas: 0,
  cancelamentos: 0,
  taxa_falta: null,
  taxa_cancelamento: null,
};

export async function GET(req: Request) {
  try {
    const { tenant_id } = await resolverTenant(req);
    const url = new URL(req.url);
    const de = url.searchParams.get("de");
    const ate = url.searchParams.get("ate");
    const sb = await getSupabaseServer();

    const [cartoes, colunas, taxa] = await Promise.all([
      sb.rpc("kanban", { p_tenant: tenant_id, p_de: de, p_ate: ate }),
      // `kanban()` devolve rótulo, cor e ordem, mas NÃO a descrição. Ela vem
      // da tabela.
      //
      // ⚠️ O `.eq("tenant_id")` aqui NÃO é o filtro redundante que o CLAUDE.md
      // proíbe. A RLS escopa a consulta a TODAS as clínicas desta conta; o
      // quadro é de UMA. Numa conta com duas clínicas, sem isto voltariam dez
      // linhas e o `Map` por `status` ficaria com a descrição de qualquer uma
      // das duas — silenciosamente, porque os status são os mesmos.
      sb.from("kanban_colunas").select("status, descricao").eq("tenant_id", tenant_id),
      sb.rpc("taxa_no_show", { p_tenant: tenant_id, p_de: de, p_ate: ate }),
    ]);

    if (cartoes.error) throw cartoes.error;

    const linhas = (cartoes.data ?? []) as LinhaKanban[];
    const descricoes = new Map(
      (colunas.data ?? []).map((c) => [c.status as string, c.descricao as string | null])
    );

    // O titular do WhatsApp, para a linha "via Fulano". `kanban()` resolve
    // QUEM é atendido (nome_cliente do agendamento, senão o lead), mas não
    // devolve o nome do lead separado — sem ele não dá para dizer que a
    // marcação foi feita por outra pessoa. A consulta é limitada aos leads que
    // já vieram nos cartões, então ela acompanha a janela de período.
    const ids = [...new Set(linhas.map((l) => l.lead_id).filter(Boolean))] as string[];
    const titulares = new Map<string, string | null>();
    if (ids.length > 0) {
      // Sem `.eq("tenant_id")`: aqui a RLS BASTA. Os ids já vieram do quadro
      // desta clínica, e o que se quer é exatamente "os leads que eu posso
      // ver, entre estes". Repetir o filtro seria o caso redundante de fato.
      const { data } = await sb.from("leads").select("id, nome").in("id", ids);
      for (const l of data ?? []) titulares.set(l.id as string, l.nome as string | null);
    }

    const porStatus = new Map<string, ColunaKanban>();
    for (const l of linhas) {
      let col = porStatus.get(l.status);
      if (!col) {
        col = {
          status: l.status,
          rotulo: l.rotulo,
          descricao: descricoes.get(l.status) ?? null,
          token: tokenDaColuna(l.cor),
          ordem: l.ordem,
          cartoes: [],
        };
        porStatus.set(l.status, col);
      }
      // Coluna vazia vem como uma linha com o agendamento todo nulo (a função
      // usa LEFT JOIN de propósito, para a coluna existir mesmo sem cartão).
      if (!l.agendamento_id || !l.quando) continue;

      const titular = l.lead_id ? titulares.get(l.lead_id) ?? null : null;
      const quem = l.quem ?? "—";
      const cartao: CartaoKanban = {
        agendamento_id: l.agendamento_id,
        lead_id: l.lead_id ?? "",
        quem,
        titular: titular && titular.trim() && titular.trim() !== quem ? titular.trim() : null,
        telefone: l.telefone,
        servico: l.servico,
        profissional: l.profissional,
        quando: l.quando,
        duracao_min: l.duracao_min,
        lembrete_enviado: l.lembrete_enviado === true,
        atrasado: l.atrasado === true,
      };
      col.cartoes.push(cartao);
    }

    const corpo: PainelKanban = {
      colunas: [...porStatus.values()].sort((a, b) => a.ordem - b.ordem),
      taxa: ((taxa.data ?? [])[0] as TaxaNoShow | undefined) ?? TAXA_VAZIA,
    };
    return NextResponse.json(corpo, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return respostaErroTenant(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenant_id } = await resolverTenant(req);
    const corpo = (await req.json()) as {
      agendamento_id?: string;
      status?: string;
    };
    if (!corpo.agendamento_id || !corpo.status) {
      return NextResponse.json(
        { erro: "informe agendamento_id e status" },
        { status: 400 }
      );
    }

    const sb = await getSupabaseServer();

    // A coluna de destino tem que ser uma das DESTA clínica. A função também
    // recusa status fora do CHECK, mas devolver 400 aqui evita gravar uma
    // tentativa no jornal de eventos por causa de um corpo malformado.
    const { data: colunas } = await sb
      .from("kanban_colunas")
      .select("status")
      .eq("tenant_id", tenant_id);
    const validos = new Set((colunas ?? []).map((c) => c.status as string));
    if (validos.size > 0 && !validos.has(corpo.status)) {
      return NextResponse.json(
        { ok: false, codigo: "STATUS_INVALIDO", motivo: "Coluna desconhecida" },
        { status: 400 }
      );
    }

    // Quem moveu, para o jornal. O e-mail é o que identifica a pessoa aqui;
    // sem sessão a rota nem chegaria neste ponto.
    const usuario = await getUsuario();
    const por = usuario?.email ?? "painel";

    const { data, error } = await sb.rpc("kanban_mover", {
      p_tenant: tenant_id,
      p_agendamento: corpo.agendamento_id,
      p_status: corpo.status,
      p_por: por,
    });
    if (error) throw error;

    const r = (data ?? [])[0] as
      | { ok: boolean; codigo: string; motivo: string }
      | undefined;
    if (!r) {
      return NextResponse.json(
        { ok: false, codigo: "NAO_ENCONTRADO", motivo: "Sem resposta do banco" },
        { status: 404 }
      );
    }
    // 200 mesmo quando `ok` é false: a resposta é a resposta do domínio, e o
    // cliente decide entre reverter e avisar pelo `codigo`. Um 500 aqui faria
    // "não encontrado" e "banco fora do ar" chegarem iguais na tela.
    return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return respostaErroTenant(e);
  }
}
