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
  const { clinicas, atual, varias, escolher } = useTenant();

  if (!varias || collapsed) return null;

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
