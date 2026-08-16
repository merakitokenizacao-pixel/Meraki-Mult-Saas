import { Hero } from "@/components/site/hero";
import { Secao } from "@/components/site/secao";
import { FraseMonumento } from "@/components/site/frase-monumento";
import { ConversaViva } from "@/components/site/conversa-viva";
import { AgendaViva } from "@/components/site/agenda-viva";
import { MockCliente } from "@/components/site/mock-cliente";
import { SecaoSeguranca } from "@/components/site/secao-seguranca";
import { SecaoNumeros } from "@/components/site/secao-numeros";
import { SecaoCta } from "@/components/site/secao-cta";
import { RodapeSite } from "@/components/site/rodape-site";

// O ritmo é o argumento. As demos rodam em vez de posar, e as duas
// frases-monumento quebram a sequência demo-demo-demo — quatro seções seguidas
// com o mesmo formato fazem cada uma parecer genérica, mesmo com conteúdo bom.
export default function SitePage() {
  return (
    <>
      <Hero />

      <Secao
        id="conversa"
        kicker="A conversa"
        titulo={<>Um minuto entre a dúvida e o horário marcado.</>}
        texto="14h32, uma desconhecida pergunta o preço. 14h33, ela tem quinta-feira reservada e a clínica tem mais um nome na agenda. Ninguém da equipe encostou no celular."
        visual={<ConversaViva />}
      />

      <FraseMonumento>Nada do que ela oferece é chute.</FraseMonumento>

      <Secao
        alt
        invertida
        largo
        kicker="A agenda"
        titulo={<>Ela sabe quem trabalha hoje e quem faz o quê.</>}
        texto="A Rozaria está na escala quinta às 20h — mas não faz microagulhamento. Então esse horário não existe para quem quer microagulhamento. Escolhe um procedimento e vê a agenda real responder."
        visual={<AgendaViva />}
      />

      <Secao
        kicker="A memória"
        titulo={<>A conversa de junho continua em dezembro.</>}
        texto="O que ela perguntou, o que evita, quanto costuma gastar, por que faltou da última vez. Ninguém repete nada — nem quando a cliente some por seis meses e volta."
        visual={<MockCliente />}
      />

      <FraseMonumento>Quando você digita, ela para.</FraseMonumento>

      <SecaoSeguranca />
      <SecaoNumeros />
      <SecaoCta />
      <RodapeSite />
    </>
  );
}
