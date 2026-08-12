import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Rotas abertas ao público:
//   /login          — a tela de entrada do CRM
//   /ficha/*        — a ficha de avaliação que a paciente preenche (sem conta)
//   /api/ficha/*    — o submit dessa ficha
// Todo o resto é o CRM e exige sessão. Em especial /api/painel/*, que devolve
// dado de saúde — é o buraco que este middleware fecha.
const PUBLICAS = ["/login", "/ficha", "/api/ficha"];

// Site institucional: rotas EXATAS, sem prefixo. `/` precisa ser tratada aqui
// porque a regra de prefixo abaixo ("/" + "/") não casaria com nada, e sem isso
// a landing responderia 307 para o login — invisível para prospects e para o
// Google. Lista de EXATAS (não prefixo) para não abrir nada além do previsto.
const SITE = new Set(["/", "/privacidade"]);

// Para onde vai quem já está logado (a raiz é o site institucional).
const HOME_PAINEL = "/visao-geral";

// Rotas que só fazem sentido para quem NÃO está logado. A landing vende a
// Laura para donas de clínica; para quem já é cliente e tem sessão, ela é só
// um obstáculo entre o atalho do navegador e o painel.
// `/privacidade` fica de fora de propósito: vale para todo mundo, logado ou não.
const SO_DESLOGADO = new Set(["/", "/login"]);

function ehPublica(pathname: string): boolean {
  if (SITE.has(pathname)) return true;
  return PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  // Resposta que carrega os cookies renovados da sessão.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // IMPORTANTE: getUser() (não getSession()) — só ele revalida o token no
  // servidor do Supabase. getSession() confia no cookie, que pode ser forjado.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !ehPublica(pathname)) {
    // API responde 401 em JSON — redirecionar um endpoint para uma página HTML
    // faria o cliente receber o login como se fosse a resposta da chamada.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
    }
    // Página: manda pro login, guardando o destino.
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("proximo", pathname);
    return NextResponse.redirect(url);
  }

  // Já logado abrindo a landing ou o login → vai direto pro painel.
  if (user && SO_DESLOGADO.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = HOME_PAINEL;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Tudo, menos estáticos e imagens (o middleware roda em toda navegação
    // para manter a sessão renovada).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
