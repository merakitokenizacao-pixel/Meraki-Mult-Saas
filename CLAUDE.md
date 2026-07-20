# VoraX — CRM para clínicas de estética

## O que é
VoraX é um CRM (SaaS) para clínicas de estética. Hoje atende a clínica **LINS Estética** (Brasília). O sistema mostra leads/clientes captados pelo WhatsApp, conversas, agenda, campanhas e métricas. Um agente de IA chamado **Laura** atende os clientes no WhatsApp (isso roda fora deste repositório, no n8n) e grava tudo no mesmo banco Supabase que este front lê.

**Estado atual:** este projeto é uma MIGRAÇÃO de um protótipo single-file (`index.html`, ~2200 linhas de HTML+CSS+JS puro) para Next.js estruturado. O arquivo original está em `/legacy/index.html` como referência fiel. **Objetivo da migração: reproduzir o sistema EXATAMENTE como está hoje (mesmas telas, mesmas funções, mesma estética), só que organizado em Next.js + TypeScript.** Não inventar features novas, não redesenhar. Paridade visual e funcional total com o legacy.

## Estado da migração
- **Etapa 0 (Fundação) — CONCLUÍDA.** Next.js 16 (App Router) + React 19 + TypeScript + **Tailwind v4** + shadcn/ui + Supabase. Layout base (sidebar luxo, topbar, nav mobile), tema claro/escuro e as 5 rotas (placeholders) no ar. `npm run build` passa.
- **Etapa 1 (Camada de dados e helpers) — CONCLUÍDA.** Tipos das 5 tabelas em `src/types/db.ts`; queries reutilizáveis em `src/lib/queries.ts`; helpers puros em `src/lib/format.ts` e `src/lib/date.ts`; componentes `Avatar` e `StatusBadge`; `showToast` como wrapper do sonner (`src/lib/toast.ts`). Validado: helpers com asserts (12/12) e leitura real de `leads` no Supabase.
- **Etapa 2 (Visão geral / dashboard) — CONCLUÍDA.** Tela `/` em `src/components/dashboard/*`: header com saudação por horário + filtro de período, 4 KPIs, clientes recentes, funil e os 2 gráficos Chart.js (doughnut de serviços, linha de novos clientes/dia). Tema integrado via context (`ThemeProvider`) — os gráficos recalculam cores ao alternar tema. `npm run build` passa.
- **Etapa 3 (Clientes / leads) — CONCLUÍDA.** Tela `/clientes` em `src/components/clientes/*`: busca por nome/telefone + filtro de período, tabela de leads e modal de detalhe (dados do lead + agendamentos + prévia da conversa). O clique nos "Clientes recentes" do dashboard agora também abre o modal. `npm run build` passa; validado via HTTP.
- **Etapa 4 (Conversas) — CONCLUÍDA.** Tela `/conversas` em `src/components/conversas/*`: inbox 3 colunas (lista · chat · perfil), abas Tudo/IA/Humano/Inativo com contagem, ordenação por última mensagem, badge de não-lidas (zera ao abrir via `update nao_lidas=0`), chat com mensagens agrupadas por dia, toggle de pausa da IA, envio otimista de mensagem (webhook n8n) com auto-pausa da IA, e painel de detalhes do cliente. `npm run build` passa; validado via HTTP.
- **Etapa 5 (Agenda) — CONCLUÍDA.** Tela `/agenda` em `src/components/agenda/*`: grade semanal (08–20h × 7 dias) com navegação de semanas, eventos posicionados por horário/minuto, linha do horário atual, modal de novo agendamento (clique numa célula ou "+ Novo") e modal de edição (status + exclusão). `npm run build` passa; validado via HTTP.
- **Etapa 6 (Campanhas) — CONCLUÍDA.** Tela `/campanhas` em `src/components/campanhas/*`: lista de campanhas com barra de progresso e modal compositor (nome, público, contador ao vivo, mensagem com `{nome}`, prévia). Ao criar, insere a campanha e enfileira `campanha_envios` em lotes de 500 (não dispara envio — isso é do n8n). `npm run build` passa; validado via HTTP.
- Próxima: **Etapa 7 — Polimento e deploy** (ver `PLANO_MIGRACAO.md`).

### 🔐 Autenticação e RLS (jul/2026) — a dívida nº 1, RESOLVIDA
Antes: RLS liberada para `anon` + anon key no bundle = **qualquer um na internet lia 214 leads (nome/telefone) e 2.551 mensagens de WhatsApp**, e a rota `/api/painel/ficha` servia **dado de saúde sem senha**. Provado e fechado.
- **Login** (`(auth)/login`): Supabase Auth, e-mail+senha. **1 conta** (a dona, `monicalbela@gmail.com`). **NÃO existe tela de cadastro** — CRM de clínica única; cadastro aberto seria só superfície de ataque. Conta nova = criar no painel do Supabase (Authentication → Users → Add user, com **Auto Confirm**).
- **Sessão em COOKIE** via `@supabase/ssr`: `src/lib/supabase.ts` trocou `createClient` → `createBrowserClient` **mantendo o nome do export**, então `queries.ts` e o realtime das Conversas não mudaram uma linha (mas agora saem autenticados). `src/lib/supabase-server.ts` = cliente de servidor (anon key + RLS); **não confundir** com `supabase-admin.ts` (service role, ignora RLS, só para a ficha pública).
- **`src/middleware.ts`**: exige sessão em tudo, EXCETO `/login`, `/ficha/*` e `/api/ficha/*` (a paciente não tem conta e nunca terá). Usa **`getUser()`, não `getSession()`** — o segundo confia num cookie forjável. Página sem sessão → 307 `/login?proximo=`; **API sem sessão → 401 JSON** (redirecionar endpoint devolveria HTML de login como resposta da chamada).
- **RLS fechada** (migration `rls_exigir_autenticacao`): as 5 policies (`leads`, `conversas`, `agendamentos`, `campanhas`, `campanha_envios`) passaram de `anon,authenticated` para **só `authenticated`**. Verificado: anon → **0 linhas** em tudo; authenticated e service role → normais.
- **A Laura NÃO é afetada**: o n8n conecta com credencial Postgres; as tabelas são do `postgres` e `relforcerowsecurity=false` → **ignora RLS**. Idem a service role.
- **Ordem obrigatória no deploy** (aprendida na marra): o login precisa estar **no ar** ANTES de fechar a RLS, senão o front antigo (que lê com anon) mostra telas vazias. Rollback: `alter policy <nome> on <tabela> to anon, authenticated;`
- ⚠️ **Armadilha de build**: `useSearchParams()` exige `<Suspense>`. O build **compila** e só o *export* quebra — grepar só `✓ Compiled` esconde a falha. **Sempre checar o exit code do `npm run build`.** Foi o que fez um deploy falhar em silêncio.
- Nota: Next 16 depreciou `middleware.ts` em favor de `proxy.ts` (só aviso; segue funcionando).

### Ficha de avaliação do laser (jul/2026 — feature nova, fora do legacy)
Fluxo: ao agendar laser pelo WhatsApp, o n8n cria uma linha em `fichas_avaliacao` e manda o link `vorax.solutions/ficha/{id}` (o token É o `id` uuid). A paciente preenche; a equipe vê no painel.
- **Tabela `fichas_avaliacao`** (já existe, não alterar): `id` (token), `lead_id`, `agendamento_id`, `tipo` ('laser'), `respostas` jsonb, `alertas` **text[] NOT NULL** (descoberto ao resetar: setar `null` dá erro 23502 — sempre gravar `[]`), `status` ('pendente'|'preenchida'|'revisada'), `criado_em`, `preenchida_em`. **RLS LIGADA sem policies** → todo acesso é server-side com **service role**.
- **Route groups (refactor estrutural):** o root `layout.tsx` agora tem só `<html>/<body>/fontes/globals.css`. O chrome do CRM (AppShell + QueryProvider + ThemeProvider + Toaster) desceu para `src/app/(painel)/layout.tsx`; as 5 rotas do painel viraram `(painel)/…` (URLs **inalteradas** — route group não entra no path). As rotas públicas ficam em `(publico)/…` e **não herdam nada do painel** (isolamento estrutural, não condicional). Verificado: `/ficha/[token]` tem 0 ocorrências de sidebar/topbar/bottom-nav/"VoraX".
- **Service role**: `SUPABASE_SERVICE_ROLE_KEY` (sem `NEXT_PUBLIC_`, fica só no servidor; **precisa ser cadastrada nas env vars da Vercel** no deploy). Cliente em `src/lib/supabase-admin.ts` (`getSupabaseAdmin()`, lazy) com `import "server-only"` no topo — o build **quebra** se for importada de um client component. Idem `src/lib/ficha-db.ts`. Verificado: nada disso aparece em `.next/static/`.
- **Página pública** `(publico)/ficha/[token]/page.tsx` (server component, `force-dynamic`, `noindex`): busca via `getFichaPublica` (só status + nome do lead + data do agendamento — respostas NUNCA sobem pro cliente). 3 estados: token inválido/inexistente → "link inválido"; `preenchida`/`revisada` → agradecimento só-leitura (sem reexibir respostas); `pendente` → `FichaForm`. `loading.tsx` e `error.tsx` próprios (marca da clínica, sem detalhe técnico). Submit com `AbortController` (20s) pra rede ruim.
- **Marca da clínica** em `src/lib/clinica.ts` (`CLINICA` + `clinicaCssVars`): nome e paleta **fixa** `--f-*` (a ficha NÃO segue o tema do painel; continua clara mesmo se a dona tiver tema escuro salvo). Pronto pra multi-tenant (nenhum componente cita "LINS" hardcoded).
- **Lógica pura** `src/lib/ficha.ts` (sem I/O, roda no cliente e no servidor): `PERGUNTAS` (13, com campo condicional que desliza no "sim"), `parseRespostas` (validação — nome+nascimento obrigatórios, todos os booleans, e detalhe obrigatório quando "sim"; a MESMA função valida no form e no route handler), `calcularAlertas` (10 regras, contraindicações primeiro), `fichaStatusVisual`/`linhasRespostas` (painel). Testado: 29 asserts (fluxo público) + 12 (painel).
- **Submit** `api/ficha/[token]/route.ts`: revalida `pendente`, calcula alertas no servidor (cliente não manda alertas), grava com `.eq("status","pendente")` → **token de uso único** mesmo sob corrida (2º submit = 0 linhas = 409).
- **Ficha no painel (Entrega 2)**: `src/components/painel/ficha-section.tsx` no modal de Clientes (`lead-modal.tsx`, entre Agendamentos e Conversa). Some se o lead não tem ficha. Badge por severidade (âmbar/verde/vermelho/vermelho forte via tokens `--vx-red/amber/green`), banner de **contraindicação visível sem clique**, respostas em pt-BR, botão "Marcar como revisada". Dados via `/api/painel/ficha?lead_id=` e `/api/painel/ficha/[id]/revisar` (server-side, service role).
- **🔴 DÍVIDA DE SEGURANÇA (Etapa 7):** as rotas `/api/painel/ficha*` são **públicas (sem login)** — o app não tem auth. Expõem dado de saúde no mesmo nível que `leads`/`conversas` já ficam hoje (RLS aberta + anon key no bundle). Decisão consciente do dono ("igual ao resto"). Resolver com login + RLS por clínica antes de qualquer deploy público.

### Campanhas (Etapa 6)
- `src/components/campanhas/`: `campanhas.tsx` (lista + progresso, `loadCampanhas`/`campBadge`), `campanha-modal.tsx` (`openCampanhaModal`/`atualizarPublico`/`atualizarPreview`/`criarCampanha`). Helpers em `src/lib/campanha.ts` (`publicoLabel`, `campBadge`, `filtrarPublico`).
- **Compositor**: contador de destinatários ao vivo (`filtrarPublico` respeita opt-out `aceita_campanha`, exige telefone e aplica o público todos/inativos_30/inativos_60), prévia trocando `{nome}` pelo 1º nome de um lead real.
- **Criar e enfileirar**: `createCampanha` (status `enviando`) + `insertCampanhaEnvios` em lotes de 500 + `updateCampanhaTotal` se houver falha parcial (em `queries.ts`). O **envio real é do n8n**; o front só enfileira.

### Agenda (Etapa 5)
- `src/components/agenda/`: `agenda.tsx` (container: fetch `getAgendamentosComLead`+`getLeads`, estado de semana, modais), `week-grid.tsx` (`renderWeekAgenda`+`renderEventsOnGrid`), `new-agend-modal.tsx` (`quickAgendamento`/`salvarAgendamento`), `edit-agend-modal.tsx` (`openEditAgendamento`/`updateAgendStatus`/excluir). Helpers em `src/lib/agenda.ts`.
- **Eventos na grade**: em vez de `querySelector`+`appendChild` (legacy), o `WeekGrid` agrupa os eventos por célula `dateStr|hora` (useMemo) e renderiza dentro de cada `.agenda-cell` posicionado por `top`/`height`. Mesma lógica de dia/hora/minuto e a `agenda-now-line`.
- **Gate de loading**: a grade só renderiza depois do fetch (estado `loading`), evitando acessar `new Date()` no SSR e mismatch de hidratação (a linha do "agora" depende do horário).
- **Mutações** em `queries.ts`: `insertAgendamento`, `updateAgendamentoStatus`, `deleteAgendamento`. Ao salvar, o lead vira `status='agendado'` (como no legacy). Reabre/recarrega via `getAgendamentosComLead`.

### Conversas (Etapa 4)
- `src/components/conversas/`: `conversas.tsx` (container com todo o estado e ações), `inbox-list.tsx` (`renderConversaList`/abas), `chat-panel.tsx` (`loadConversas`/`enviarMensagemCRM`/`toggleIA`), `details-panel.tsx` (`renderConversaDetails`).
- Helpers puros em `src/lib/conversa.ts`: `isLeadPaused`, `isLeadInativo` (>30 dias), `getTemp` (score→tier), `getLTV`, `getIASummary`, `getTags`, `getChannelIcon`, `getLastMsgPreview`, `lastMsgInfo` (ordenação), `formatDayLabel`.
- **Badge de não-lidas**: zera no cache local + persiste `update nao_lidas=0` ao abrir a conversa (não bloqueia a UI). Ordenação do inbox por timestamp da última mensagem, igual ao WhatsApp.
- **Inbox usa a view `conversa_ultima_por_lead` (jul/2026, fix de escala)**: `useConversas` puxa `getUltimaConversaPorLead()` (1 linha por lead via `distinct on`, `security_invoker`), NÃO todas as mensagens. Antes, `getConversas()` (`select *`) batia no teto de 1000 linhas do PostgREST (a base já tinha 2116) e devolvia as **mais antigas** → previews/ordem do inbox ficavam errados. O chat abre o histórico completo por lead via `getConversasByLead` (inalterado).
- **toggleIA / auto-pausa**: ao enviar mensagem pelo CRM, se a IA estiver ativa ela é pausada antes do envio (`ia_pausada=true`, `pausada_por='humano'`...). O envio vai para o **webhook do n8n** (`src/lib/n8n.ts`), configurável por `NEXT_PUBLIC_N8N_WEBHOOK_ENVIAR_MSG` (com default = URL do legacy). Render otimista: bolha "enviando…" → "enviado ✓"/"falhou ⚠".
- **Tipos**: `Lead` ganhou campos opcionais que o legacy lê/escreve defensivamente (`temperatura`, `tags`, `pausada_em`, `motivo_pausa`) — podem não existir no banco ainda. Mutação `updateLead(id, fields)` em `queries.ts`.
- **CSS**: keyframes `pulse-dot` ajustado para a versão por opacidade (no legacy, a 2ª definição com mesmo nome vence globalmente — vale para o dot da sidebar e o da IA).
- Sem realtime/auto-refresh (herdado do legacy; ver pendências). Mensagem enviada aparece otimista; a versão persistida virá do n8n no próximo open da conversa.

#### Redesign visual (jul/2026, inspirado no DataCraze) — SÓ apresentação
Reestruturação da camada visual das Conversas (queries/mutations, pausa da IA e webhook **inalterados**). Rompe a paridade com o legacy **nesta tela de propósito**. As outras 4 telas seguem iguais.
- **4 zonas**: (1) *nav rail* = a **sidebar global entra colapsada** em `/conversas` (64px, ícones+tooltips+ativo dourado); o estado `collapsed` inicia `true` quando a rota é `/conversas` (sem flash no SSR) + um efeito colapsa ao navegar pra lá, mas **o toggle continua visível e funcional** (dá pra expandir); (2) Inbox ~340px; (3) Chat (protagonista, ocupa o resto); (4) Painel do cliente **colapsável**.
- **Componentes reescritos em Tailwind v4 + tokens `--vx-*`** (claro/escuro): `inbox-list.tsx` (busca client-side por nome/telefone, chips com contador, cards respirados com divisor sutil, empty state), `chat-panel.tsx` (header ~64px, bolhas ≤65% diferenciando cliente/IA/humano, separadores HOJE/ONTEM, composer em pill, empty "Conversas"), `details-panel.tsx` (painel com header + fechar). Ícones do `lucide-react`. Skeletons em `skeletons.tsx`.
- **Painel colapsável**: estado `panelOpen` no container (default aberto ≥1440px), botão `PanelRight` no header do chat. Desktop = 3ª coluna do grid (`lg:grid-cols-[340px_minmax(0,1fr)_360px]`); quando fechado o chat expande (`lg:grid-cols-[340px_minmax(0,1fr)]`).
- **Responsivo <1024px (`lg`)**: master-detail — inbox e chat empilham (lista → chat em tela cheia com botão **voltar** que limpa `currentLeadId`); o painel vira **drawer** (overlay fixo à direita). Feito com classes condicionais por `currentLeadId` + breakpoint `lg`.
- **CSS antigo removido**: o bloco "CONVERSAS — inbox 3 colunas" foi apagado do `globals.css` (incluindo a regra que escondia o painel <1100px). O subconjunto `.msg-*` que o **modal de Clientes** usa permanece (fica na seção Clientes).
- **Full-bleed (jul/2026)**: `/conversas` ocupa a tela toda. O `AppShell` aplica `content-flush` (`.content{padding:0}`) só nessa rota; o container usa `.conversas-fill` (`height: calc(100vh - 64px)`, e `- 132px` no mobile p/ descontar a bottom-nav) e perdeu arredondado/borda/sombra externos — dividers ficam só entre as colunas.

### Clientes (Etapa 3)
- `src/components/clientes/`: `clientes.tsx` (container: fetch `getLeads`, estado de busca/período, seleção do lead), `leads-table.tsx` (`renderLeadsTable`), `lead-modal.tsx` (`openLeadModal`).
- **Modal próprio em vez do shadcn Dialog**: o modal do legacy tem layout/anim próprios (overlay com blur, `slideUp`, botão `modal-close` quadrado). Para paridade pixel-a-pixel criei `src/components/modal.tsx` (overlay + ESC + clique-fora + scroll lock), reutilizável nos modais de Agenda/Campanhas. CSS `.modal*` portado para `globals.css`.
- **Tabela em markup nativo** (não shadcn Table) com CSS do legacy escopado em `.table-wrap` — mesmo motivo de paridade. Filtro replica `applyLeadsFilter` (data + busca; telefone e canal exibidos crus, como no legacy).
- Portado também para `globals.css`: `.search-bar`, tabela, `.modal*`, subconjunto de bolhas `.msg-*` (o restante das Conversas vem na Etapa 4) e keyframes `fadeIn`/`slideUp`.
- **Pendência local**: o badge de contagem na nav lateral ("Clientes", `leads-count-badge` do legacy, = nº de leads de hoje) ainda não foi implementado — depende de estado compartilhado entre rotas; fica para depois.
- **Cadastro manual de lead (jul/2026)**: `new-lead-modal.tsx` + botão "+ Novo cliente" no header. `insertLead()` em `queries.ts` insere na tabela `leads` (nome/telefone/canal/status); `telefone` é único → duplicado retorna `23505` e a UI mostra "Já existe um cliente com esse telefone". O telefone é normalizado para dígitos + DDI `55` (formato do n8n), pra o lead manual **casar** com o mesmo lead quando ele mandar WhatsApp (o n8n faz upsert por telefone). Ao salvar, invalida `['leads']`. **Parte do movimento de reduzir a dependência 100% da IA — CRM operável à mão.**

### Nota de operação (Windows + dev server)
Ao reiniciar o `next dev`, se a porta 3000 aparecer "in use", há um processo `next` órfão (no Windows, `kill`/encerrar o `npm` não derruba o filho `node`). Ele pode servir CSS **defasado** do cache do Turbopack (foi o que quebrou visualmente a Etapa 2 até reiniciar limpo). Resolver com `taskkill /PID <pid> /T /F` na árvore e, se necessário, apagar `.next` antes de subir. Sempre dar **hard refresh** (Ctrl+Shift+R) no navegador após mudanças de CSS.

**Como DIAGNOSTICAR** (a armadilha já mordeu 2×, e as duas vezes o código estava certo): baixe o CSS que o dev está servindo e procure a regra nova nele —
`curl -s localhost:3000/ | grep -oE '/_next/static/chunks/[^"]*\.css'` e então `curl -s localhost:3000<arquivo> | grep 'sua-regra'`.
Se o **hash do nome do arquivo não mudou** depois de você editar o CSS, é cache: o fonte está certo e o servidor está velho. `taskkill //IM node.exe //F` mata os órfãos; se o `rm -rf .next` reclamar "Directory not empty", é porque ainda há `node` segurando o arquivo — mate primeiro, apague depois.

### Dashboard (Etapa 2)
- Estrutura em `src/components/dashboard/`: `dashboard.tsx` (container: fetch `getLeads`+`getAgendamentos`, estado de período e saudação), `metrics-grid.tsx`, `recent-leads.tsx`, `funnel.tsx`, `service-chart.tsx`, `timeline-chart.tsx`.
- **Tema dos gráficos**: `ThemeProvider` (`src/components/theme-provider.tsx`) virou a fonte única do tema (substituiu `lib/use-theme.ts`, removido). O toggle vive na topbar; os gráficos consomem o context e releem as CSS vars (`getChartStyle` em `src/lib/chart.ts`) ao trocar de tema.
- **Charts SSR**: `ServiceChart`/`TimelineChart` só renderizam após `mounted` (gate) para não acessar `document`/`getComputedStyle` no servidor.
- **"Consultas agendadas" — AJUSTADO (jun/2026), diverge do legacy de propósito.** Agora conta **linhas de `agendamentos`** no período (cada marcação = 1), excluindo `cancelado`, filtrando por **`agendamentos.criado_em`** (quando a consulta foi MARCADA), não por `data_agendamento`. Intenção: "quantas consultas foram agendadas neste período". A **"Receita estimada"** usa o MESMO conjunto (mesmo filtro `criado_em`, sem cancelados, com `valor`) para receita e contagem baterem. `agendamentos.criado_em` existe no banco (`timestamptz`, `default now()`, `NOT NULL`, 100% preenchido). A **"Taxa de conversão"** NÃO mudou: continua sendo de *leads* (`agendado`+`convertido`)/total de leads. Receita segue R$ 0,00 enquanto `agendamentos.valor` vier vazio (n8n).
- **Pendência local**: os itens de "Clientes recentes" ainda não abrem o modal de lead (não há clique) — isso entra na Etapa 3 junto com `openLeadModal`.

### Camada de dados (Etapa 1)
- **Tipos** (`src/types/db.ts`): `Lead`, `Conversa`, `Agendamento` (+ `AgendamentoComLead` para o join da Agenda), `Campanha`, `CampanhaEnvio`. Status como unions com fallback de string (`Loose<>`), pois o n8n pode gravar valores fora da lista.
- **Queries** (`src/lib/queries.ts`): `getLeads`, `getLeadById`, `getLeadsParaCampanha`, `getAgendamentos`, `getAgendamentosComLead`, `getAgendamentosByLead`, `getConversas`, `getConversasByLead`, `getCampanhas`. Espelham as queries do legacy (mesmas ordenações/joins) e lançam em erro.
- **Helpers** (`src/lib/format.ts`): `getInitials`, `getAvatarColors`/`AVATAR_PALETTE`, `fmtDate`, `getRelativeTime`, `limparServico`, `formatTelefone`, `statusBadgeClass`. (`src/lib/date.ts`): `getDateRange`, `filterByDate`. Portados 1:1 do legacy.
- **Componentes** (substituem os geradores de HTML do legacy): `Avatar` (`renderAvatar` — foto com fallback p/ iniciais) e `StatusBadge` (`badgeHtml`). CSS de `.avatar`/`.badge*`/`.loading`/`.spinner`/`.empty` portado para `globals.css`.

### Camada de dados com cache (React Query, jul/2026 — em migração incremental)
- **Motivo**: cada tela fazia `useState + useEffect(fetch on mount)`, refazendo os mesmos `select` a cada navegação, sem cache. Adotamos **TanStack Query** por cima das queries existentes (não altera `queries.ts` nem o Supabase).
- `QueryProvider` (`src/components/query-provider.tsx`) no `layout.tsx` (envolve `ThemeProvider`): `staleTime` 30s (navegar não refaz fetch), `refetchOnWindowFocus:false`, `retry:1`, e **toast de erro global** via `QueryCache.onError` (some o try/catch por tela).
- Hooks em `src/lib/hooks.ts`: `useLeads`, `useAgendamentos`, `useAgendamentosComLead` (key `['agendamentos','com-lead']`), `useConversas`, `useCampanhas`. queryKeys dos agendamentos compartilham o prefixo `['agendamentos']` (invalidar o prefixo pega lista com/sem join).
- **Status: as 5 telas migradas.** Dashboard/Clientes usam `useLeads`; Agenda usa `useAgendamentosComLead`+`useLeads`; Conversas usa `useLeads`+`useConversas`+`useAgendamentos`; Campanhas usa `useCampanhas`. Após mutações, as telas chamam `qc.invalidateQueries` (ex.: Agenda invalida `['agendamentos']`+`['leads']`).
- **Mutações otimistas (Conversas)**: `setLeads`/`setConversas` foram redefinidos como `qc.setQueryData(['leads'|'conversas'], updater)` — o corpo das ações (`openConversa`/`toggleIA`/`enviarMensagem`) não mudou (já usavam a forma `set(prev => ...)`). Fonte única no cache.
- **Realtime — ATIVO (jul/2026)**: `conversas.tsx` tem um `supabase.channel('conversas-crm')` que invalida `['conversas']`/`['leads']` em `postgres_changes`. As tabelas `conversas` e `leads` foram adicionadas à publicação `supabase_realtime` (migration `enable_realtime_conversas_leads`), então o inbox **atualiza sozinho** quando o n8n/cliente grava. (RLS liberado p/ anon, então o cliente do browser recebe os eventos.)

### Decisões de arquitetura (Etapa 0)
- **Navegação por rotas reais do App Router** (não SPA com `showPage`): `/` (Visão geral), `/clientes`, `/conversas`, `/agenda`, `/campanhas`. O `AppShell` (`src/components/app-shell.tsx`) é o chrome comum; o item ativo vem de `usePathname`. Config das telas em `src/lib/nav.ts`.
- **Tailwind v4 (config CSS-first via `@theme`)**, não há `tailwind.config.ts`. Tokens em `src/app/globals.css`.
- **Design tokens da marca sob prefixo `--vx-*`** (ex.: `--vx-surface`, `--vx-accent`) para não colidir com os tokens semânticos do shadcn. Expostos como utilitários Tailwind: `bg-vx-surface`, `text-vx-accent`, `border-vx-border2`, etc. Os tokens do shadcn (`--background`, `--primary`, `--border`, `--muted`, `--accent`…) **derivam** da paleta `--vx-*`, então os componentes shadcn já saem na estética bege/dourado.
- **Tema** acionado por `data-theme="dark"` no `<html>` (igual ao legacy). Persistido em `localStorage` (`vorax-theme`); script anti-flash no `<head>` (`layout.tsx`); toggle em `src/lib/use-theme.ts`. O `dark:` do Tailwind responde a `data-theme` via `@custom-variant`.
- **Fontes** via `next/font/google` em `layout.tsx`: Cormorant Garamond (`--font-cormorant`, serif/títulos), Jost (`--font-jost`, texto), JetBrains Mono (`--font-jetbrains`, mono).
- **CSS do chrome** (sidebar/topbar/nav mobile) portado fielmente do legacy para `globals.css` (com `var(--X)` → `var(--vx-X)`). Os componentes das telas (próximas etapas) usam Tailwind/shadcn.
- **Ícones da navegação (jul/2026)**: os glifos unicode do menu foram trocados por **line icons do `lucide-react`** (componentes em `src/lib/nav.ts`): Visão geral=`LayoutDashboard`, Clientes=`Users`, Conversas=`MessageCircle`, Agenda=`CalendarDays`, Campanhas=`Send`. Renderizados com `size={20}` e `strokeWidth={1.5}`. Cor via token da paleta: `.nav-icon { color: var(--vx-accent) }` com `opacity` 0.4 (normal) → 0.7 (hover) → 1 (ativo), então acompanha claro/escuro. O bottom-nav mobile usa os mesmos ícones (herda a cor de `.bottom-nav-item`: muted/accent). Só a navegação foi trocada; os demais ícones/emojis do sistema seguem como estavam.
- **Sidebar colapsável (jul/2026)** — **implementação própria** (não o componente `Sidebar` do shadcn), porque a sidebar é um elemento bespoke "luxo" (gradiente sempre escuro); adotar o do shadcn exigiria re-tematizar do zero. Estado `collapsed` (local no `AppShell`, sem persistência). A largura é uma CSS var `--vx-sidebar-w` (236px → 64px colapsada; 208px no tablet ≤1100px), usada por `.sidebar` (width) e `.main` (margin-left) com transição de 0.3s; `.layout.collapsed` alterna o valor. Botão `.sidebar-toggle` no topo da sidebar (chevrons do lucide). No colapsado: logo vira "V", `.nav-label`/`.nav-section`/`.sidebar-status-text` somem, ícones centralizam, e há **tooltip** via `.nav-item::after { content: attr(data-label) }` (sidebar com `overflow: visible` no colapsado pra não cortar). Tudo escopado em `@media (min-width: 641px)` — no mobile a sidebar continua slide-over com hambúrguer e o toggle some. Destaque dourado do item ativo mantido.
- **Supabase**: cliente em `src/lib/supabase.ts`; credenciais em `.env.local` (gitignored; `.env.example` versionado). A anon key foi extraída do legacy.
- O arquivo legacy foi renomeado de `index.html 80.html` para `legacy/index.html` (batendo com a doc).

## Stack
- **Next.js (App Router) + React + TypeScript**
- **Tailwind CSS** para estilo (replicar os design tokens abaixo)
- **shadcn/ui** para componentes base (botões, modais, tabelas, selects)
- **Supabase** (já existente, não migrar o banco) via `@supabase/supabase-js`
- **Chart.js** (já usado no legacy para os gráficos do dashboard)
- Deploy na **Vercel** (push no GitHub publica)

## Princípios deste projeto
- Single-tenant por enquanto (só a LINS). Estruturar de forma que dê pra evoluir pra multi-clínica depois, mas NÃO implementar multi-tenant agora.
- Paridade com o legacy acima de tudo. Em caso de dúvida de comportamento, abrir `/legacy/index.html` e seguir o que ele faz.
- Componentes pequenos e reutilizáveis. Nada de arquivos gigantes.
- Tema claro/escuro: o legacy tem os dois, manter.
- Português do Brasil em toda a UI.

## Design tokens (copiar exatamente do legacy)
Fontes (Google Fonts): **Cormorant Garamond** (títulos/serif), **Jost** (texto/sans), **JetBrains Mono** (mono).

Tema claro:
- bg #f8f6f2 · surface #ffffff · surface2 #f2efe9 · surface3 #e8e4dc
- border #e0dbd2 · border2 #c8c2b8 · text #1a1814 · text2 #3d3930
- accent #9b7d5a · accent2 #7a6244 · accent-light #f5ede0
- gold #b8955a · gold-light #f7f0e4
- green #3a6b4f · green-bg #e8f4ed · amber #b5600a · amber-bg #fdf0e0 · blue #2a5278 · blue-bg #e8f0f8

Tema escuro:
- bg #111009 · surface #1a1814 · surface2 #222018 · surface3 #2e2b22
- border #38352a · border2 #4a4638 · text #f0ece4 · text2 #c4bfb4
- accent #c8a07a · accent2 #d4b08a (demais cores: extrair do bloco `[data-theme="dark"]` do legacy)

Paleta bege/dourado, estética sofisticada e calma. Os valores completos (incluindo os que não estão listados aqui) devem ser extraídos das variáveis CSS `:root` e `[data-theme="dark"]` no `/legacy/index.html`.

## As 5 telas (paridade obrigatória com o legacy)
1. **Visão geral** (dashboard) — KPIs (Clientes captados, Consultas agendadas, Taxa de conversão, Receita estimada), filtro de período (Hoje/Ontem/Semana/Mês/Tudo), clientes recentes, funil de conversão, gráficos (serviços, timeline). Funções legacy: `loadDashboard`, `renderDashboardMetrics`, `renderServiceChart`, `renderTimelineChart`.
2. **Clientes** (leads) — tabela de leads com filtro, modal de detalhe. Funções: `renderLeadsTable`, `applyLeadsFilter`, `openLeadModal`.
3. **Conversas** — inbox de 3 colunas (lista / chat / perfil), abas (Tudo/IA/Humano/Inativo), badge de não-lidas, envio de mensagem, toggle de pausa da IA. Funções: `loadConversaLeads`, `renderConversaList`, `loadConversas`, `enviarMensagemCRM`, `toggleIA`, `renderConversaDetails`. (Detalhes importantes: ordenação por última mensagem; badge de não-lidas zera ao abrir via `update nao_lidas=0`.)
4. **Agenda** — visão semanal em grade, navegação de semanas, eventos posicionados na grade, modal de novo agendamento. Funções: `loadAgendamentos`, `renderWeekAgenda`, `renderEventsOnGrid`, `quickAgendamento`.
5. **Campanhas** — lista de campanhas com progresso, modal compositor (público, contador ao vivo, prévia). Funções: `loadCampanhas`, `openCampanhaModal`, `criarCampanha`.

Helpers compartilhados no legacy (virar utils/components): `renderAvatar`, `getInitials`, `badgeHtml`, `formatTelefone`, `fmtDate`, `getRelativeTime`, `getDateRange`, `filterByDate`, `showToast`, `showPage`, `toggleTheme`, `limparServico`.

## Banco de dados (Supabase — JÁ EXISTE, não recriar)
URL do projeto: `https://sflpxenfyewefzwizimf.supabase.co` (a anon key vai em variável de ambiente, ver abaixo).
Timezone do projeto: America/Sao_Paulo.

Tabelas (5):
- **leads** — chave de negócio é `telefone` (único, usado como chave de upsert pelo n8n). Campos usados pelo front: `id`, `nome`, `telefone`, `status` (novo/agendado/convertido/...), `canal`, `origem`, `foto_url`, `nao_lidas`, `ia_pausada`, `pausada_por`, `resumo_ia`, `score_ia`, `aceita_campanha`, `ultima_interacao`, `criado_em`.
- **conversas** — histórico de mensagens. Campos: `id`, `lead_id` (FK), `mensagem`, `origem` ('cliente' | 'agente' | 'humano'), `enviado_em`.
- **agendamentos** — Campos: `id`, `lead_id` (FK), `servico`, `data_agendamento`, `duracao_min`, `status` (pendente/confirmado/cancelado/realizado), `origem`, `valor` (existe na tabela; hoje vem vazio porque o n8n ainda não preenche — a "Receita estimada" depende disso).
- **campanhas** — `id`, `nome`, `mensagem`, `publico`, `status` (rascunho/enviando/concluida/pausada), `total`, `enviados`, datas.
- **campanha_envios** — fila: `id`, `campanha_id` (FK), `lead_id` (FK), `telefone`, `nome`, `status`, unique(campanha_id, lead_id).

RLS liberado para anon/authenticated (single-tenant). Não alterar schema sem necessidade; se precisar, registrar aqui e gerar migration.

## Variáveis de ambiente (.env.local)
- `NEXT_PUBLIC_SUPABASE_URL` = a URL acima
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = a anon key (pegar no painel do Supabase; NUNCA commitar a service_role key)

## O que NÃO está neste repositório
- O agente Laura, o FAQ, o Agente Agenda, os fluxos: tudo isso vive no **n8n** (nuvem), não aqui. Este front só LÊ e ESCREVE no Supabase. Não tentar implementar o agente aqui.
- Mudanças de prompt/fluxo do agente são feitas fora deste projeto.

## Pendências conhecidas (NÃO são bugs da migração; herdadas do legacy)
- "Receita estimada" mostra R$ 0,00 porque `agendamentos.valor` vem vazio (o n8n não preenche). Migrar como está; resolver depois.
- ~~"Consultas agendadas"~~ **RESOLVIDO (jun/2026):** agora conta linhas de `agendamentos` (não leads), por `criado_em`, sem cancelados; "Receita estimada" usa o mesmo filtro. Ver detalhe na seção "Dashboard (Etapa 2)".
- ~~Inbox não tem realtime~~ **RESOLVIDO (jul/2026):** Supabase Realtime ativo em `conversas`/`leads` + invalidação do cache React Query no `conversas.tsx`. Ver "Camada de dados com cache".

## Como manter este arquivo
Ao concluir uma etapa de migração ou tomar uma decisão de arquitetura, ATUALIZE este CLAUDE.md (seção de estado e pendências). Este arquivo é a memória do projeto; mantê-lo curado evita perda de contexto entre sessões.
