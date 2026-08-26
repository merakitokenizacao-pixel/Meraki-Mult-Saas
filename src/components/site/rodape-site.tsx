import Link from "next/link";
import { RAZAO_SOCIAL, CNPJ } from "@/lib/site";

// O rodapé não existia. Página que vende software para clínica sem razão
// social, CNPJ e política de privacidade parece landing de infoproduto — e a
// LGPD não é opcional para quem processa dado de saúde.
export function RodapeSite() {
  return (
    <footer className="s-rodape">
      <div className="s-rodape-inner">
        <div className="s-rodape-legal">
          {RAZAO_SOCIAL && <span>{RAZAO_SOCIAL}</span>}
          {CNPJ && <span>CNPJ {CNPJ}</span>}
          <span>© 2026 Meraki</span>
        </div>
        <nav className="s-rodape-links">
          <Link href="/privacidade">Política de privacidade</Link>
          {/* Termos de uso: a rota /termos não existe e o texto é jurídico —
              inventar cláusula seria pior que a ausência do link. Assim que o
              documento existir, é uma linha aqui e uma entrada no allowlist do
              middleware (SITE), como /privacidade. */}
        </nav>
      </div>
    </footer>
  );
}
