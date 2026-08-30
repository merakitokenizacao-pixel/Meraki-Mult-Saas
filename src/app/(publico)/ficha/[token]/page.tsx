import type { Metadata } from "next";
import { getSupabaseServer } from "@/lib/supabase-server";
import { ehToken, type FormularioPublico } from "@/lib/requisitos";
import { FormularioPublico as Formulario } from "@/components/requisito/formulario-publico";
import { JaRespondido, LinkRecusado } from "@/components/requisito/estados";

// O formulário de requisito, aberto pela cliente sem login.
//
// ⚠️ ESTA ROTA MUDOU DE DONO em ago/2026. Ela servia a ficha de avaliação do
// painel antigo, que lia `fichas_avaliacao` — tabela que NÃO EXISTE neste
// banco. Ou seja: o que estava aqui não funcionava, e não havia link em
// circulação apontando para cá (a LINS continua no painel antigo, em outro
// domínio). Os componentes daquele fluxo seguem em `components/ficha/`, sem
// rota, esperando a limpeza do A3.

export const dynamic = "force-dynamic";

// Dado de saúde: nunca cachear, nunca indexar. E nenhuma marca do Meraki —
// quem manda o link é a clínica, e é o nome dela que a cliente reconhece.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

/** Uma linha por pergunta; as três primeiras colunas repetem em todas. */
interface LinhaFormulario {
  requisito: string;
  descricao: string | null;
  ja_respondido: boolean;
  chave: string;
  pergunta: string;
  tipo: string;
  obrigatorio: boolean;
  ordem: number;
}

export default async function FichaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // ⚠️ O token é UUID no banco. Um link malformado não devolveria zero linhas:
  // levantaria `22P02 invalid input syntax for type uuid`, e "link errado"
  // chegaria na tela como erro de sistema. A guarda vem antes da consulta.
  if (!ehToken(token)) return <LinkRecusado />;

  const sb = await getSupabaseServer();
  const { data, error } = await sb.rpc("requisito_formulario", { p_token: token });
  // Sem detalhe do porquê: dizer "token expirado" contra "token inexistente"
  // conta a quem estiver adivinhando qual das duas coisas ele acertou.
  if (error) return <LinkRecusado />;

  const linhas = (data ?? []) as LinhaFormulario[];
  if (linhas.length === 0) return <LinkRecusado />;
  if (linhas[0].ja_respondido) return <JaRespondido />;

  const form: FormularioPublico = {
    requisito: linhas[0].requisito,
    descricao: linhas[0].descricao,
    ja_respondido: false,
    perguntas: linhas
      .map((l) => ({
        chave: l.chave,
        pergunta: l.pergunta,
        tipo: l.tipo as FormularioPublico["perguntas"][number]["tipo"],
        obrigatorio: l.obrigatorio,
        ordem: l.ordem,
      }))
      .sort((a, b) => a.ordem - b.ordem),
  };

  return (
    <main className="rq-root">
      <header className="rq-topo">
        <h1 className="rq-clinica">{form.requisito}</h1>
        {form.descricao && <p className="rq-descricao">{form.descricao}</p>}
      </header>
      <Formulario token={token} form={form} />
    </main>
  );
}
