# Plano de Migração VoraX — HTML → Next.js

Este é o roteiro que o Claude Code deve seguir, **uma etapa de cada vez**, validando ao fim de cada uma antes de passar pra próxima. NÃO fazer tudo de uma vez: migrar por etapas é o que mantém a paridade e evita perda de contexto. Ao terminar cada etapa, atualizar o `CLAUDE.md` e fazer um commit.

Referência fiel do comportamento esperado: `/legacy/index.html`. Em qualquer dúvida de "como deve funcionar", abrir o legacy e seguir.

## Etapa 0 — Fundação
- Criar projeto Next.js (App Router) + TypeScript + Tailwind.
- Instalar e configurar shadcn/ui.
- Configurar o cliente Supabase (`@supabase/supabase-js`) lendo de `.env.local`.
- Portar os design tokens (cores claro/escuro + fontes Cormorant/Jost/JetBrains) pro Tailwind (config + CSS variables) e implementar o toggle de tema.
- Criar o layout base: sidebar (Visão geral, Clientes, Conversas, Agenda, Campanhas) + topbar, igual ao legacy.
- **Validar:** app sobe, tema claro/escuro funciona, navegação entre páginas (mesmo que vazias) funciona, estética bate com o legacy.
- Commit: "fundação: next + tailwind + shadcn + supabase + layout".

## Etapa 1 — Camada de dados e helpers
- Criar os tipos TypeScript das 5 tabelas (leads, conversas, agendamentos, campanhas, campanha_envios) conforme o schema no CLAUDE.md.
- Criar funções de acesso ao Supabase (queries) reutilizáveis.
- Portar os helpers puros do legacy: `getInitials`, `renderAvatar`, `badgeHtml`, `formatTelefone`, `fmtDate`, `getRelativeTime`, `getDateRange`, `filterByDate`, `limparServico`, `showToast` (como toast do shadcn).
- **Validar:** consegue buscar leads do Supabase e logar no console; helpers testados.
- Commit.

## Etapa 2 — Visão geral (dashboard)
- KPIs, filtro de período, clientes recentes, funil, gráficos (Chart.js).
- Replicar `loadDashboard`, `renderDashboardMetrics`, `renderServiceChart`, `renderTimelineChart`.
- **Validar:** números e gráficos batem com o legacy lado a lado.
- Commit.

## Etapa 3 — Clientes (leads)
- Tabela com filtro + modal de detalhe (`renderLeadsTable`, `applyLeadsFilter`, `openLeadModal`).
- **Validar:** lista e modal idênticos ao legacy.
- Commit.

## Etapa 4 — Conversas (a tela mais complexa)
- Inbox 3 colunas, abas (Tudo/IA/Humano/Inativo), badge de não-lidas (zera ao abrir via `update nao_lidas=0`), ordenação por última mensagem, envio de mensagem, toggle de pausa da IA, painel de perfil.
- Replicar: `loadConversaLeads`, `renderConversaList`, `loadConversas`, `enviarMensagemCRM`, `toggleIA`, `renderConversaDetails`, `filterByInboxTab`, `getLastMsgPreview`.
- **Validar com atenção:** ordenação, badge sumindo ao abrir e voltando com msg nova, pausa/retomada da IA.
- Commit.

## Etapa 5 — Agenda
- Grade semanal, navegação de semanas, eventos na grade, modal de novo agendamento.
- Replicar: `loadAgendamentos`, `renderWeekAgenda`, `renderEventsOnGrid`, `quickAgendamento`.
- **Validar:** eventos no lugar certo, navegação de semana.
- Commit.

## Etapa 6 — Campanhas
- Lista com progresso + modal compositor (público, contador ao vivo, prévia).
- Replicar: `loadCampanhas`, `openCampanhaModal`, `criarCampanha`, `filtrarPublico`.
- **Validar:** criar campanha enfileira igual ao legacy (sem disparar nada).
- Commit.

## Etapa 7 — Polimento e deploy
- Revisar responsividade (o legacy tem nav mobile).
- Conferir tema escuro em todas as telas.
- Deploy na Vercel, configurar as env vars.
- Atualizar CLAUDE.md com o estado final.
- Commit + deploy.

## Regras gerais
- Ao fim de CADA etapa: validar contra o legacy, atualizar CLAUDE.md, commitar.
- Não adicionar features que não existem no legacy.
- Não mexer no schema do Supabase sem registrar no CLAUDE.md.
- Manter componentes pequenos; nada de recriar o "arquivo monstro".
