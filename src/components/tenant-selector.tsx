"use client";

import { useTenant } from "@/components/tenant-provider";

// Seletor de clínica, no topo da sidebar.
//
// Só aparece para quem atende MAIS DE UMA. Com uma clínica só, o tenant é
// implícito e um seletor de item único seria ruído: ocupa uma linha do menu
// para dizer o que a conta inteira já diz.
//
// Some também quando a sidebar está recolhida: em 64px não cabe nome de
// clínica, e um <select> cortado é pior que ausente — a escolha continua
// valendo, ela só não é editável ali.
export function TenantSelector({ collapsed }: { collapsed: boolean }) {
  const { clinicas, atual, varias, carregando, escolher } = useTenant();

  if (collapsed || carregando) return null;

  // Conta sem vínculo nenhum. É um beco sem saída — alguém precisa rodar
  // `vincular_conta()` — e o painel não pode simplesmente aparecer vazio: sem
  // esta linha, toda tela responde 403 e a pessoa fica procurando o que
  // clicou de errado. Situação DIFERENTE de "escolha a clínica", que se
  // resolve no seletor abaixo.
  if (clinicas.length === 0) {
    return (
      <div className="tenant-sel">
        <p className="tenant-sel-aviso">
          Esta conta ainda não está vinculada a uma clínica.
        </p>
      </div>
    );
  }

  if (!varias) return null;

  return (
    <div className="tenant-sel">
      <label className="tenant-sel-rotulo" htmlFor="tenant-sel">
        Clínica
      </label>
      <select
        id="tenant-sel"
        className="tenant-sel-campo"
        value={atual?.tenant_id ?? ""}
        onChange={(e) => escolher(e.target.value)}
      >
        {/* Sem escolha ainda: o servidor recusa com "informe qual", então a
            opção vazia precisa existir para o estado ser representável. */}
        {!atual && <option value="">Selecione…</option>}
        {clinicas.map((c) => (
          <option key={c.tenant_id} value={c.tenant_id}>
            {c.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
