"use client";

import { useState } from "react";
import { CalendarClock, Palette, UserCog, type LucideIcon } from "lucide-react";
import { SecaoAparencia } from "@/components/configuracoes/secao-aparencia";
import { SecaoConta } from "@/components/configuracoes/secao-conta";
import { SecaoProfissionais } from "@/components/configuracoes/secao-profissionais";

type SecaoId = "aparencia" | "profissionais" | "conta";

const SECOES: ReadonlyArray<{
  id: SecaoId;
  label: string;
  descricao: string;
  icon: LucideIcon;
}> = [
  {
    id: "profissionais",
    label: "Horários de trabalho",
    descricao:
      "Quem atende, em que horários — é daqui que sai a capacidade da agenda",
    icon: CalendarClock,
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
  const [secao, setSecao] = useState<SecaoId>("profissionais");
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
              <span>{s.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Conteúdo */}
      <div className="config-content">
        <header className="config-header">
          <h1 className="config-title">{atual.label}</h1>
          <p className="config-subtitle">{atual.descricao}</p>
        </header>

        {secao === "profissionais" && <SecaoProfissionais />}
        {secao === "aparencia" && <SecaoAparencia />}
        {secao === "conta" && <SecaoConta />}
      </div>
    </div>
  );
}
