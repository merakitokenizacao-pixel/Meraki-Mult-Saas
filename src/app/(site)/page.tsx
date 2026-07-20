import { Hero } from "@/components/site/hero";
import { SecaoConversa } from "@/components/site/secao-conversa";
import { Secao } from "@/components/site/secao";
import { SecaoFeatures } from "@/components/site/secao-features";
import { MockAgenda } from "@/components/site/mock-agenda";
import { MockCliente } from "@/components/site/mock-cliente";
import { MockFicha } from "@/components/site/mock-ficha";

// Uma capacidade por seção, cada uma com o produto real ao lado, alternando
// fundo branco / off-white. O ritmo é o argumento: a página desce mostrando,
// não listando.
export default function SitePage() {
  return (
    <>
      <Hero />

      <SecaoConversa />

      <Secao
        alt
        invertida
        kicker="A agenda"
        titulo={
          <>
            Ela sabe quantas <span className="text-s-gold">mãos</span> você tem.
          </>
        }
        texto="Três profissionais às 15h significam três clientes — não uma. A Laura conhece a escala de cada uma, respeita folga e almoço, e nunca promete um horário que não existe."
        visual={<MockAgenda />}
      />

      <Secao
        kicker="A memória"
        titulo={<>Ela lembra de cada cliente.</>}
        texto="Preferências, histórico, o que já perguntou e quanto costuma gastar. Ninguém precisa repetir nada — nem na conversa daqui a seis meses."
        visual={<MockCliente />}
      />

      <Secao
        alt
        invertida
        kicker="A segurança"
        titulo={
          <>
            A contraindicação aparece <span className="text-s-gold">antes</span>.
          </>
        }
        texto="Antes do laser, a cliente preenche a ficha pelo celular. Se houver risco, sua equipe vê em vermelho no cadastro dela — sem precisar abrir nada."
        visual={<MockFicha />}
      />

      <SecaoFeatures />
    </>
  );
}
