import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Rotas abertas ao público (a paciente NÃO tem conta):
//   /login          — a própria tela de entrada
//   /ficha/*        — a ficha de avaliação que a cliente preenche
//   /api/ficha/*    — o submit dessa ficha
// Todo o resto é o CRM e exige sessão. Em especial /api/painel/*, que devolve
// dado de saúde e hoje está aberto — é o buraco que este middleware fecha.
const PUBLICAS = ["/login", "/ficha", "/api/ficha"];

function ehPublica(pathname: string): boolean {
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

  // Já logado abrindo /login → vai direto pro painel.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
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
