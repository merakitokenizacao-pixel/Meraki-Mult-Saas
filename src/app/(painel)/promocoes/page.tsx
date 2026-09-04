import { redirect } from "next/navigation";

// Promoções virou sub-item de Configurações (ver src/lib/nav.ts).
//
// A rota fica de pé e redireciona: link antigo, favorito e histórico do
// navegador continuam levando a algum lugar. Sem isto a URL daria 404 para
// quem tinha a tela salva — e um 404 numa tela que existe é o pior dos dois
// mundos.
export default function PromocoesPage() {
  redirect("/configuracoes");
}
