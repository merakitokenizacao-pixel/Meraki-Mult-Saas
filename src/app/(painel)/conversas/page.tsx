import { Suspense } from "react";
import { Conversas } from "@/components/conversas/conversas";

// O <Suspense> é obrigatório: Conversas usa useSearchParams() (para abrir
// /conversas?lead=<id> vindo dos Follow-ups), e sem a fronteira o build quebra
// no export (missing-suspense-with-csr-bailout) — a mesma armadilha do login.
export default function ConversasPage() {
  return (
    <Suspense fallback={null}>
      <Conversas />
    </Suspense>
  );
}
