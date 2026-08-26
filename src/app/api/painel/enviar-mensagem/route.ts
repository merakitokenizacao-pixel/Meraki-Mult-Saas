import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { EvolutionErro, enviarTexto } from "@/lib/evolution";
import {
  resolverTenant,
  respostaErroTenant,
} from "@/lib/tenant-server";

export const dynamic = "force-dynamic";

// Envio de mensagem pelo CRM.
//
// Antes o navegador chamava um webhook do n8n direto. Isso trouxe três
// problemas de uma vez, e os três somem com a chamada saindo do servidor:
//   1. o host do n8n caiu e o envio parou, sem mensagem de erro decente;
//   2. sendo cross-origin com Content-Type: application/json, o navegador
//      exigia preflight OPTIONS — que o webhook não precisava responder;
//   3. a URL ficava no bundle, então qualquer um disparava WhatsApp pela
//      clínica sem login.
//
// O middleware já exige sessão em /api/painel/* e devolve 401 JSON sem ela.

const LIMITE_TEXTO = 4096; // limite prático do WhatsApp

/** Compara telefone pelo que ele é — dígitos — e não pela formatação. */
function soDigitos(v: unknown): string {
  return typeof v === "string" ? v.replace(/[^0-9]/g, "") : "";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "payload_invalido" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const leadId = typeof b.lead_id === "string" ? b.lead_id : "";
  const telefone = typeof b.telefone === "string" ? b.telefone : "";
  const mensagem = typeof b.mensagem === "string" ? b.mensagem.trim() : "";

  if (!leadId || !telefone || !mensagem) {
    return NextResponse.json({ erro: "campos_obrigatorios" }, { status: 400 });
  }
  if (mensagem.length > LIMITE_TEXTO) {
    return NextResponse.json({ erro: "mensagem_longa" }, { status: 400 });
  }

  // O tenant ANTES do envio, de propósito.
  //
  // Esta rota manda WhatsApp em nome da clínica e depois grava no histórico.
  // Se o escopo fosse conferido só na hora de gravar, uma requisição com
  // lead_id/telefone de outra clínica já teria ENTREGADO a mensagem quando o
  // erro aparecesse — e mensagem entregue não volta atrás.
  let tenant: string;
  try {
    tenant = (await resolverTenant(req)).tenant_id;
  } catch (e) {
    return respostaErroTenant(e);
  }

  // O lead precisa ser DESTA clínica. `lead_id` e `telefone` vêm do corpo:
  // sem esta conferência, bastaria um uuid alheio para disparar WhatsApp pelo
  // número da clínica para o cliente de outra — e o histórico ficaria na
  // conversa errada.
  //
  // Confere também o telefone: os dois campos vêm do cliente e nada obriga
  // que combinem entre si. Aceitar o par sem casar permitiria usar um lead
  // válido como passe para mandar mensagem a um número qualquer.
  try {
    const db = getSupabaseAdmin();
    const { data: lead, error } = await db
      .from("leads")
      .select("id, telefone")
      .eq("id", leadId)
      .eq("tenant_id", tenant)
      .maybeSingle();
    if (error) throw error;
    if (!lead) {
      return NextResponse.json({ erro: "lead_nao_encontrado" }, { status: 404 });
    }
    if (soDigitos(lead.telefone) !== soDigitos(telefone)) {
      return NextResponse.json({ erro: "telefone_divergente" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ erro: "erro_interno" }, { status: 500 });
  }

  let idExterno: string | null = null;
  try {
    const r = await enviarTexto(telefone, mensagem);
    idExterno = r.id;
  } catch (e) {
    const err = e as EvolutionErro;
    return NextResponse.json(
      { erro: "falha_no_envio", detalhe: err.message },
      { status: err.status && err.status >= 400 ? err.status : 502 }
    );
  }

  // GRAVA o histórico. Medido: o fluxo do n8n captura o que a dona digita no
  // CELULAR, mas NÃO o que sai pela API — a mensagem de teste chegou no
  // WhatsApp e não apareceu em `conversas`. Sem esta escrita, o que fosse
  // enviado pelo CRM sumiria do chat no próximo refresh.
  //
  // Depois do envio, de propósito: falha ao gravar não pode fazer o operador
  // reenviar uma mensagem que a cliente já recebeu.
  try {
    const db = getSupabaseAdmin();
    const { error } = await db.from("conversas").insert({
      tenant_id: tenant,
      lead_id: leadId,
      mensagem,
      origem: "humano",
    });
    if (error) {
      return NextResponse.json(
        { ok: true, id: idExterno, aviso: "enviada_mas_nao_registrada" },
        { status: 200 }
      );
    }
  } catch {
    return NextResponse.json(
      { ok: true, id: idExterno, aviso: "enviada_mas_nao_registrada" },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true, id: idExterno });
}
