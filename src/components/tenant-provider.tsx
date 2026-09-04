"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { guardarTenantEscolhido, tenantEscolhido } from "@/lib/api-painel";
import type { Clinica } from "@/lib/tenant";

// Quais clínicas esta conta atende, e qual está selecionada.
//
// A lista vem de `minhas_clinicas()`, que é SECURITY DEFINER sobre auth.uid():
// o navegador não consegue pedir a clínica de outra pessoa nem por engano —
// o universo que chega aqui já é o permitido.
//
// A seleção é conveniência de INTERFACE, não credencial. Ela viaja no
// cabeçalho e o banco revalida a cada requisição (ver src/lib/tenant-server.ts).
// Alguém que edite o localStorage à mão não ganha nada além de um 403.

interface EstadoTenant {
  clinicas: Clinica[];
  atual: Clinica | null;
  /**
   * Como a clínica chama a própria agente — vem de `tenant_config.agente_nome`.
   *
   * ⚠️ NENHUM NOME DE AGENTE ESCRITO EM COMPONENTE. O painel inteiro dizia
   * "a agente", que é a agente da clínica antiga; a da LINS é a Sofia e uma odonto
   * vai querer outro. Nome de agente é dado da clínica, como o endereço.
   *
   * "a agente" é o fallback enquanto carrega ou quando o campo está vazio —
   * genérico de propósito, porque um nome errado é pior que nenhum.
   */
  agente: string;
  /** `tenant_config.agente_ativo`: false = a agente não responde nada. */
  agenteAtivo: boolean;
  /** Atalho para o id da clínica atual — a escrita de config precisa dele. */
  tenantId: string | null;
  /** Relê `tenant_config` depois de o interruptor mudar. */
  recarregarAgente: () => Promise<void>;
  carregando: boolean;
  /** Mais de uma clínica: é o que faz o seletor aparecer. */
  varias: boolean;
  escolher: (tenantId: string) => void;
}

const Ctx = createContext<EstadoTenant | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  // tenant_id → { nome, ativo }. Um mapa, e não um valor só, porque a conta
  // pode atender duas clínicas e cada uma batiza — e liga ou desliga — a sua.
  const [agentes, setAgentes] = useState<
    Record<string, { nome: string; ativo: boolean }>
  >({});

  const carregarAgentes = useCallback(async () => {
    // `tenant_config` tem a RLS padrão: a consulta já vem recortada nas
    // clínicas desta conta.
    const cfg = await supabase
      .from("tenant_config")
      .select("tenant_id, agente_nome, agente_ativo");
    const mapa: Record<string, { nome: string; ativo: boolean }> = {};
    for (const linha of cfg.data ?? []) {
      mapa[linha.tenant_id as string] = {
        nome: ((linha.agente_nome as string | null) ?? "").trim(),
        ativo: linha.agente_ativo !== false,
      };
    }
    setAgentes(mapa);
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await supabase.rpc("minhas_clinicas");
      if (!vivo) return;
      const lista = (error ? [] : ((data ?? []) as Clinica[]));
      setClinicas(lista);

      // A escolha guardada só vale se ainda estiver na lista: vínculo removido,
      // ou localStorage de outra conta no mesmo navegador, não podem deixar o
      // painel preso num tenant que a conta não atende mais.
      const guardado = tenantEscolhido();
      const valido = guardado && lista.some((c) => c.tenant_id === guardado);
      if (!valido && guardado) guardarTenantEscolhido(null);
      setEscolhido(valido ? guardado : null);
      setCarregando(false);

      await carregarAgentes();
    })();
    return () => {
      vivo = false;
    };
  }, [carregarAgentes]);

  const escolher = useCallback((tenantId: string) => {
    guardarTenantEscolhido(tenantId);
    setEscolhido(tenantId);
  }, []);

  const valor = useMemo<EstadoTenant>(() => {
    // Com uma clínica só, ela é a atual sem ninguém ter escolhido nada — e o
    // cabeçalho nem é enviado, porque o servidor resolve o implícito.
    const atual =
      clinicas.find((c) => c.tenant_id === escolhido) ??
      (clinicas.length === 1 ? clinicas[0] : null);
    const cfg = atual ? agentes[atual.tenant_id] : undefined;
    return {
      clinicas,
      atual,
      agente: cfg?.nome || "a agente",
      // `true` enquanto carrega: o padrão do banco é ativo, e mostrar
      // "desligada" por um instante em quem NÃO desligou é pior que o inverso.
      agenteAtivo: cfg?.ativo ?? true,
      tenantId: atual?.tenant_id ?? null,
      recarregarAgente: carregarAgentes,
      carregando,
      varias: clinicas.length > 1,
      escolher,
    };
  }, [clinicas, escolhido, carregando, escolher, agentes, carregarAgentes]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useTenant(): EstadoTenant {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTenant precisa estar dentro de <TenantProvider>");
  return ctx;
}
