"use client";

import { useState } from "react";
import {
  CalendarClock,
  ClipboardList,
  Send,
  Tag,
  Palette,
  Bot,
  Grid3x3,
  Smartphone,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { SecaoAparencia } from "@/components/configuracoes/secao-aparencia";
import { SecaoMatriz } from "@/components/configuracoes/secao-matriz";
import { SecaoRequisitos } from "@/components/configuracoes/secao-requisitos";
import { SecaoEnvios } from "@/components/configuracoes/secao-envios";
import { Promocoes } from "@/components/promocoes/promocoes";
import { SecaoAgente } from "@/components/configuracoes/secao-agente";
import { useTenant } from "@/components/tenant-provider";
import { SecaoConexao } from "@/components/configuracoes/secao-conexao";
import { SecaoConta } from "@/components/configuracoes/secao-conta";
import { SecaoProfissionais } from "@/components/configuracoes/secao-profissionais";

type SecaoId =
  | "agente"
  | "profissionais"
  | "matriz"
  | "requisitos"
  | "promocoes"
  | "envios"
  | "conexao"
  | "aparencia"
  | "conta";

const SECOES: ReadonlyArray<{
  id: SecaoId;
  label: string;
  descricao: string;
  icon: LucideIcon;
}> = [
  {
    id: "agente",
    // O rótulo é substituído pelo nome real da clínica no render — a
    // constante não tem como saber qual é.
    label: "Agente",
    descricao: "Se a agente está atendendo, e onde ela está calada",
    icon: Bot,
  },
  {
    id: "profissionais",
    label: "Horários de trabalho",
    descricao:
      "Quem atende, em que horários — é daqui que sai a capacidade da agenda",
    icon: CalendarClock,
  },
  {
    id: "matriz",
    label: "Quem faz o quê",
    descricao:
      "Quais procedimentos cada profissional atende — nem todas fazem tudo",
    icon: Grid3x3,
  },
  {
    id: "requisitos",
    label: "Requisitos",
    descricao:
      "O que precisa estar respondido antes de um procedimento acontecer",
    icon: ClipboardList,
  },
  {
    id: "promocoes",
    label: "Promoções",
    descricao:
      "As ofertas que a agente conhece — ela só oferece o que estiver no ar aqui",
    icon: Tag,
  },
  {
    id: "envios",
    label: "Envios automáticos",
    descricao:
      "Quando o sistema pode falar sozinho — e com quem ele não fala",
    icon: Send,
  },
  {
    id: "conexao",
    label: "Conexão",
    descricao:
      "O WhatsApp pelo qual a agente atende — e o que fazer quando ele cai",
    icon: Smartphone,
  },
  {
    id: "aparencia",
    label: "Aparência",
    descricao: "Tema claro ou escuro",
    icon: Palette,
  },
  {
    id: "conta",
    label: "Minha conta",
    descricao: "Seu acesso ao sistema",
    icon: UserCog,
  },
];

export function Configuracoes() {
  const { agente } = useTenant();
  const [secao, setSecao] = useState<SecaoId>("agente");
  const atual = SECOES.find((s) => s.id === secao)!;

  return (
    <div className="page-fade config-layout">
      {/* Sub-navegação */}
      <nav className="config-nav">
        {SECOES.map((s) => {
          const Icon = s.icon;
          const ativo = s.id === secao;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSecao(s.id)}
              className={`config-nav-item${ativo ? " active" : ""}`}
              aria-current={ativo ? "page" : undefined}
            >
              <Icon size={15} strokeWidth={1.5} />
              <span>{s.id === "agente" ? agente : s.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Conteúdo */}
      <div className="config-content">
        <header className="config-header">
          <h1 className="config-title">
            {atual.id === "agente" ? agente : atual.label}
          </h1>
          <p className="config-subtitle">{atual.descricao}</p>
        </header>

        {secao === "agente" && <SecaoAgente />}
        {secao === "profissionais" && <SecaoProfissionais />}
        {secao === "matriz" && <SecaoMatriz />}
        {secao === "requisitos" && <SecaoRequisitos />}
        {secao === "promocoes" && <Promocoes />}
        {secao === "envios" && <SecaoEnvios />}
        {secao === "conexao" && <SecaoConexao />}
        {secao === "aparencia" && <SecaoAparencia />}
        {secao === "conta" && <SecaoConta />}
      </div>
    </div>
  );
}
