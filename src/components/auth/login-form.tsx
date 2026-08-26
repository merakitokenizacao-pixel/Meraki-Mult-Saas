"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail, TriangleAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Mensagens de erro genéricas de propósito: não confirmar se um e-mail existe
// (isso entrega a lista de usuários para quem estiver tentando adivinhar).
function mensagemErro(codigo: string | undefined): string {
  if (codigo === "invalid_credentials") return "E-mail ou senha incorretos.";
  if (codigo === "email_not_confirmed") return "E-mail ainda não confirmado.";
  if (codigo === "over_request_rate_limit")
    return "Muitas tentativas. Aguarde um instante.";
  return "Não foi possível entrar. Tente novamente.";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Depois de entrar vai para o painel — a raiz agora é o site institucional.
  const proximo = params.get("proximo") || "/visao-geral";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEntrando(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });
      if (error) {
        setErro(mensagemErro(error.code));
        setEntrando(false);
        return;
      }
      // refresh() faz o middleware reler o cookie da sessão nova.
      router.replace(proximo);
      router.refresh();
    } catch {
      setErro("Falha de conexão. Verifique sua internet.");
      setEntrando(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-mk-bg px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <div className="font-[family-name:var(--font-cormorant)] text-[34px] font-light tracking-wide text-mk-text">
            Merak<em className="text-mk-accent not-italic">i</em>
          </div>
          <p className="mt-2 text-[13px] text-mk-muted">
            Acesso restrito à equipe da clínica
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-mk-border bg-mk-surface p-7"
          style={{ boxShadow: "var(--mk-shadow-lg)" }}
        >
          <div className="mb-4">
            <label className="form-label" htmlFor="email">
              E-mail
            </label>
            <div className="relative">
              <Mail
                size={15}
                strokeWidth={1.5}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mk-muted"
              />
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={{ paddingLeft: 34 }}
                placeholder="voce@clinica.com"
              />
            </div>
          </div>

          <div className="mb-5">
            <label className="form-label" htmlFor="senha">
              Senha
            </label>
            <div className="relative">
              <Lock
                size={15}
                strokeWidth={1.5}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mk-muted"
              />
              <input
                id="senha"
                type="password"
                required
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="form-input"
                style={{ paddingLeft: 34 }}
                placeholder="••••••••"
              />
            </div>
          </div>

          {erro && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-mk-red-bg px-3.5 py-2.5 text-[12.5px] leading-snug text-mk-red">
              <TriangleAlert size={15} strokeWidth={1.8} className="mt-px shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={entrando}
            className="btn-primary flex w-full items-center justify-center gap-2"
            style={{
              opacity: entrando ? 0.6 : 1,
              cursor: entrando ? "default" : "pointer",
            }}
          >
            {entrando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Entrando…
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[11.5px] leading-relaxed text-mk-muted">
          Não há cadastro aberto. Para liberar um acesso, fale com o
          administrador do sistema.
        </p>
      </div>
    </div>
  );
}
