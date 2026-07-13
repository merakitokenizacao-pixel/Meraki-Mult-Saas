"use client";

import { useEffect, useState } from "react";
import { Check, KeyRound, Loader2, Mail, TriangleAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";

const MIN_SENHA = 8;

export function SecaoConta() {
  const [email, setEmail] = useState<string | null>(null);
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (nova.length < MIN_SENHA) {
      setErro(`A senha precisa ter pelo menos ${MIN_SENHA} caracteres.`);
      return;
    }
    if (nova !== confirma) {
      setErro("As duas senhas não são iguais.");
      return;
    }

    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: nova });
    setSalvando(false);

    if (error) {
      setErro(
        error.code === "same_password"
          ? "A nova senha é igual à atual."
          : "Não foi possível trocar a senha. Tente novamente."
      );
      return;
    }
    setNova("");
    setConfirma("");
    showToast("Senha alterada com sucesso", "success");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="config-card">
        <div className="config-linha">
          <div className="config-linha-icone">
            <Mail size={16} strokeWidth={1.5} />
          </div>
          <div>
            <div className="config-linha-label">E-mail de acesso</div>
            <div className="config-linha-valor">{email ?? "…"}</div>
          </div>
        </div>
        <p className="config-nota">
          Não há cadastro aberto: contas novas são criadas pelo administrador do
          sistema. Se precisar liberar acesso para outra pessoa, fale com ele.
        </p>
      </div>

      <div className="config-card">
        <form onSubmit={trocarSenha}>
          <div className="config-linha" style={{ marginBottom: 16 }}>
            <div className="config-linha-icone">
              <KeyRound size={16} strokeWidth={1.5} />
            </div>
            <div>
              <div className="config-linha-label">Trocar senha</div>
              <div className="config-linha-valor" style={{ fontSize: 12.5 }}>
                Mínimo de {MIN_SENHA} caracteres
              </div>
            </div>
          </div>

          <div className="config-grid-2" style={{ marginBottom: 12 }}>
            <div>
              <label className="form-label" htmlFor="nova">
                Nova senha
              </label>
              <input
                id="nova"
                type="password"
                className="form-input"
                autoComplete="new-password"
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="form-label" htmlFor="confirma">
                Repita a nova senha
              </label>
              <input
                id="confirma"
                type="password"
                className="form-input"
                autoComplete="new-password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          {erro && (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--vx-red-bg)",
                color: "var(--vx-red)",
                fontSize: 12.5,
                marginBottom: 12,
              }}
            >
              <TriangleAlert size={15} strokeWidth={1.8} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>{erro}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={salvando || !nova || !confirma}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              opacity: salvando || !nova || !confirma ? 0.5 : 1,
              cursor: salvando || !nova || !confirma ? "not-allowed" : "pointer",
            }}
          >
            {salvando ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Salvando…
              </>
            ) : (
              <>
                <Check size={15} strokeWidth={2} /> Trocar senha
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
