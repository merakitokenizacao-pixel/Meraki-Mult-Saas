import { Check, LinkIcon } from "lucide-react";
import { Card, FichaShell } from "@/components/ficha/ficha-shell";
import { formatDiaProcedimento } from "@/lib/ficha";

// Estados terminais da página pública. Nenhum deles reexibe respostas.

export function LinkInvalido() {
  return (
    <FichaShell>
      <Card>
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-[var(--f-accent-light)]">
            <LinkIcon
              size={24}
              strokeWidth={1.5}
              className="text-[var(--f-accent-dark)]"
            />
          </div>
          <h2 className="font-[family-name:var(--font-cormorant)] text-[24px] font-medium text-[var(--f-text)]">
            Link inválido ou expirado
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--f-text2)]">
            Não conseguimos abrir esta ficha. Se você recebeu o link pelo
            WhatsApp, é só responder por lá que enviamos um novo.
          </p>
        </div>
      </Card>
    </FichaShell>
  );
}

export function FichaRecebida({
  dataAgendamento,
  nome,
}: {
  dataAgendamento: string | null;
  nome?: string | null;
}) {
  const dia = formatDiaProcedimento(dataAgendamento);
  const primeiroNome = nome?.trim().split(/\s+/)[0];

  return (
    <FichaShell>
      <Card>
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-[var(--f-accent-light)]">
            <Check
              size={26}
              strokeWidth={2}
              className="text-[var(--f-accent-dark)]"
            />
          </div>
          <h2 className="font-[family-name:var(--font-cormorant)] text-[26px] font-medium text-[var(--f-text)]">
            {primeiroNome ? `Tudo certo, ${primeiroNome}!` : "Ficha recebida!"}
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--f-text2)]">
            Sua ficha de avaliação já está com a nossa equipe.
          </p>
          {dia && (
            <p className="mt-6 w-full rounded-xl bg-[var(--f-accent-light)] px-4 py-3 text-[14.5px] font-medium text-[var(--f-accent-dark)]">
              Te esperamos {dia}!
            </p>
          )}
          <p className="mt-6 text-[13px] leading-relaxed text-[var(--f-muted)]">
            Se precisar corrigir alguma informação, é só falar com a gente pelo
            WhatsApp.
          </p>
        </div>
      </Card>
    </FichaShell>
  );
}
