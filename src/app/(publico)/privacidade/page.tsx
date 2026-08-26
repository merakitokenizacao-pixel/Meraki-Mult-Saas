import type { Metadata } from "next";
import { CLINICA } from "@/lib/clinica";

// Aviso de privacidade das pessoas atendidas pela clínica. Fica no route group
// público (mesma marca da ficha, sem nada do painel), mas — ao contrário da
// ficha — PRECISA ser indexável: um aviso que ninguém acha não cumpre o papel.
export const metadata: Metadata = {
  title: `Política de Privacidade — ${CLINICA.nomeCurto}`,
  description: `Como a ${CLINICA.nomeCurto} trata os dados pessoais e de saúde de quem é atendido pela clínica.`,
  robots: { index: true, follow: true },
};

// ⚠️ PREENCHER antes de divulgar o link. São os únicos dados que o código não
// tem como saber. Enquanto estiverem vazios, a página exibe um aviso no lugar
// do canal de contato em vez de fingir que existe um.
const CONTATO = {
  email: "", // ex.: "privacidade@linsestetica.com.br"
  telefone: "", // WhatsApp oficial da clínica, ex.: "(61) 9xxxx-xxxx"
  endereco: "", // endereço completo da clínica
  cnpj: "",
};

const ATUALIZADO_EM = "31 de julho de 2026";

const temContato = Boolean(CONTATO.email || CONTATO.telefone);

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 34 }}>
      <h2
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: "var(--f-text)",
          marginBottom: 10,
          lineHeight: 1.3,
        }}
      >
        {titulo}
      </h2>
      <div style={{ color: "var(--f-text2)", fontSize: 14.5, lineHeight: 1.75 }}>
        {children}
      </div>
    </section>
  );
}

export default function PrivacidadePage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 22px 80px",
        background: "var(--f-bg)",
      }}
    >
      <header style={{ borderBottom: "1px solid var(--f-border)", paddingBottom: 22 }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--f-accent)",
            fontWeight: 600,
          }}
        >
          {CLINICA.nome}
        </p>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 600,
            color: "var(--f-text)",
            marginTop: 8,
            lineHeight: 1.2,
          }}
        >
          Política de Privacidade
        </h1>
        <p style={{ color: "var(--f-muted)", fontSize: 13, marginTop: 10 }}>
          Atualizada em {ATUALIZADO_EM}
        </p>
      </header>

      <Secao titulo="Em resumo">
        <p>
          A {CLINICA.nomeCurto} coleta seus dados para atender você pelo WhatsApp,
          marcar seus procedimentos e — quando o procedimento exige — verificar se
          ele é seguro para você. Não vendemos seus dados e não usamos suas
          informações para nenhuma outra finalidade.
        </p>
      </Secao>

      <Secao titulo="Quem trata seus dados">
        <p>
          A <strong>{CLINICA.nome}</strong> é a controladora: é ela quem decide
          quais dados são coletados e para quê. A Meraki fornece o sistema que
          armazena e organiza essas informações, atuando como operadora, apenas
          seguindo as instruções da clínica.
        </p>
        {(CONTATO.cnpj || CONTATO.endereco) && (
          <p style={{ marginTop: 10 }}>
            {CONTATO.cnpj && <>CNPJ {CONTATO.cnpj}. </>}
            {CONTATO.endereco}
          </p>
        )}
      </Secao>

      <Secao titulo="Quais dados coletamos">
        <ul style={{ paddingLeft: 20, display: "grid", gap: 8 }}>
          <li>
            <strong>Identificação e contato:</strong> nome, telefone e a foto de
            perfil pública do seu WhatsApp.
          </li>
          <li>
            <strong>Histórico de atendimento:</strong> as mensagens trocadas com a
            clínica pelo WhatsApp.
          </li>
          <li>
            <strong>Agendamentos:</strong> procedimento, data, horário e situação
            da marcação.
          </li>
          <li>
            <strong>Dados de saúde:</strong> somente quando você preenche a ficha
            de avaliação enviada antes de um procedimento a laser. São perguntas
            de segurança — gestação, uso de medicamentos e ácidos, doenças
            autoimunes, alergias, melasma, marca-passo, tatuagens na região e
            exposição solar recente.
          </li>
        </ul>
      </Secao>

      <Secao titulo="Por que tratamos cada um">
        <p>
          Dados de contato, conversas e agendamentos são tratados para executar o
          atendimento que você solicitou e para a gestão da clínica (Lei nº
          13.709/2018, art. 7º, incisos V e IX).
        </p>
        <p style={{ marginTop: 10 }}>
          Os <strong>dados de saúde</strong> são dados sensíveis e recebem
          tratamento próprio: são coletados mediante o seu consentimento
          específico, ao preencher a ficha, e para a tutela da sua saúde em
          procedimento realizado por profissional de saúde (art. 11, incisos I e
          II, alínea &ldquo;f&rdquo;). Servem exclusivamente para identificar
          contraindicações antes do procedimento. Você pode recusar o
          preenchimento — nesse caso o procedimento a laser não poderá ser
          realizado com segurança.
        </p>
      </Secao>

      <Secao titulo="Atendimento por inteligência artificial">
        <p>
          O primeiro atendimento no WhatsApp pode ser feito por um assistente
          automatizado. Ele tira dúvidas, informa valores e marca horários. A
          qualquer momento você pode pedir para falar com uma pessoa da equipe, e
          o atendimento passa para um atendente humano. Nenhuma decisão sobre a
          realização de um procedimento é tomada de forma automatizada: a
          avaliação é sempre da profissional.
        </p>
      </Secao>

      <Secao titulo="Onde ficam e quem acessa">
        <p>
          As informações ficam em banco de dados com acesso restrito, e só a
          equipe autorizada da clínica, autenticada com login e senha, consegue
          consultá-las. As respostas da ficha de avaliação nunca são exibidas
          publicamente: o link que você recebe é pessoal, serve uma única vez e
          deixa de funcionar depois do envio.
        </p>
        <p style={{ marginTop: 10 }}>
          As mensagens trafegam pelo WhatsApp, operado pela Meta, sujeito às
          políticas da própria plataforma. Não compartilhamos seus dados com
          terceiros para publicidade e não os vendemos.
        </p>
      </Secao>

      <Secao titulo="Por quanto tempo guardamos">
        <p>
          Enquanto durar seu relacionamento com a clínica e, depois disso, pelos
          prazos que a legislação exigir — inclusive os prazos aplicáveis a
          registros de atendimento em saúde. Encerrados esses prazos, os dados são
          eliminados ou anonimizados.
        </p>
      </Secao>

      <Secao titulo="Seus direitos">
        <p>
          A Lei Geral de Proteção de Dados garante a você, a qualquer momento e
          sem custo: confirmar se tratamos seus dados; acessá-los; corrigir dados
          incompletos ou desatualizados; pedir a eliminação dos dados tratados com
          base no seu consentimento; solicitar a portabilidade; saber com quem
          foram compartilhados; e revogar o consentimento.
        </p>
        <p style={{ marginTop: 10 }}>
          A revogação do consentimento não desfaz os tratamentos já realizados, e
          alguns dados podem ser mantidos quando a lei obriga.
        </p>
      </Secao>

      <Secao titulo="Como falar conosco">
        {temContato ? (
          <p>
            Para exercer qualquer um desses direitos, fale com a clínica
            {CONTATO.email && (
              <>
                {" "}
                pelo e-mail{" "}
                <a href={`mailto:${CONTATO.email}`} style={{ color: "var(--f-accent-dark)" }}>
                  {CONTATO.email}
                </a>
              </>
            )}
            {CONTATO.email && CONTATO.telefone && " ou"}
            {CONTATO.telefone && <> pelo WhatsApp {CONTATO.telefone}</>}. Respondemos
            no menor prazo possível.
          </p>
        ) : (
          <p
            style={{
              border: "1px solid var(--f-border)",
              borderLeft: "3px solid var(--f-danger)",
              background: "var(--f-surface)",
              padding: "12px 14px",
              borderRadius: 8,
            }}
          >
            O canal oficial de contato ainda não foi publicado. Enquanto isso,
            solicite seus direitos pelo mesmo WhatsApp em que você é atendida pela
            clínica.
          </p>
        )}
      </Secao>

      <p
        style={{
          marginTop: 44,
          paddingTop: 20,
          borderTop: "1px solid var(--f-border)",
          color: "var(--f-muted)",
          fontSize: 12.5,
          lineHeight: 1.7,
        }}
      >
        Esta política pode ser atualizada. A data no topo indica a versão vigente.
      </p>
    </main>
  );
}
