"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

// Sair. Limpa o cache do React Query junto — senão os dados da clínica ficariam
// em memória e apareceriam por um instante no próximo login.
export function LogoutButton({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    await supabase.auth.signOut();
    qc.clear();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={sair}
      disabled={saindo}
      className="sidebar-logout"
      aria-label="Sair"
      title="Sair"
      data-label="Sair"
    >
      <LogOut className="nav-icon" size={18} strokeWidth={1.5} />
      {!collapsed && <span className="nav-label">Sair</span>}
    </button>
  );
}
