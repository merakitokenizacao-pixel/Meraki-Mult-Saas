import { Loader2 } from "lucide-react";
import { Card, FichaShell } from "@/components/ficha/ficha-shell";

// Mostrado enquanto o servidor busca a ficha (rota force-dynamic). Mantém a
// marca da clínica no ar mesmo com rede lenta, em vez de tela em branco.
export default function CarregandoFicha() {
  return (
    <FichaShell>
      <Card>
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <Loader2
            size={26}
            className="animate-spin text-[var(--f-accent)]"
          />
          <p className="text-[14px] text-[var(--f-text2)]">
            Carregando sua ficha…
          </p>
        </div>
      </Card>
    </FichaShell>
  );
}
