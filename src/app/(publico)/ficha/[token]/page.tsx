import type { Metadata } from "next";
import { CLINICA } from "@/lib/clinica";
import { isTokenValido } from "@/lib/ficha";
import { getFichaPublica } from "@/lib/ficha-db";
import { FichaForm } from "@/components/ficha/ficha-form";
import { FichaRecebida, LinkInvalido } from "@/components/ficha/estados";

// Dado de saúde: nunca cachear, nunca indexar.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Ficha de avaliação — ${CLINICA.nomeCurto}`,
  robots: { index: false, follow: false, nocache: true },
};

export default async function FichaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Token malformado: nem consulta o banco.
  if (!isTokenValido(token)) return <LinkInvalido />;

  let ficha;
  try {
    ficha = await getFichaPublica(token);
  } catch {
    // Sem detalhe técnico para a paciente (e sem log do conteúdo da ficha).
    return <LinkInvalido />;
  }

  if (!ficha) return <LinkInvalido />;

  // Já preenchida ou revisada: agradecimento, somente leitura.
  if (ficha.status !== "pendente") {
    return (
      <FichaRecebida
        dataAgendamento={ficha.dataAgendamento}
        nome={ficha.nomeLead}
      />
    );
  }

  return <FichaForm token={token} nomeInicial={ficha.nomeLead ?? ""} />;
}
