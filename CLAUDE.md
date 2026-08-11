# VoraX — CRM para clínicas de estética

## O que é
VoraX é um CRM (SaaS) para clínicas de estética. Hoje atende a clínica **LINS Estética** (Brasília). O sistema mostra leads/clientes captados pelo WhatsApp, conversas, agenda, promoções e métricas. Um agente de IA chamado **Laura** atende os clientes no WhatsApp (isso roda fora deste repositório, no n8n) e grava tudo no mesmo banco Supabase que este front lê.

**Estado atual:** este projeto é uma MIGRAÇÃO de um protótipo single-file (`index.html`, ~2200 linhas de HTML+CSS+JS puro) para Next.js estruturado. O arquivo original está em `/legacy/index.html` como referência fiel. **Objetivo da migração: reproduzir o sistema EXATAMENTE como está hoje (mesmas telas, mesmas funções, mesma estética), só que organizado em Next.js + TypeScript.** Não inventar features novas, não redesenhar. Paridade visual e funcional total com o legacy.

## Estado da migração
- **Etapa 0 (Fundação) — CONCLUÍDA.** Next.js 16 (App Router) + React 19 + TypeScript + **Tailwind v4** + shadcn/ui + Supabase. Layout base (sidebar luxo, topbar, nav mobile), tema claro/escuro e as 5 rotas (placeholders) no ar. `npm run build` passa.
- **Etapa 1 (Camada de dados e helpers) — CONCLUÍDA.** Tipos das 5 tabelas em `src/types/db.ts`; queries reutilizáveis em `src/lib/queries.ts`; helpers puros em `src/lib/format.ts` e `src/lib/date.ts`; componentes `Avatar` e `StatusBadge`; `showToast` como wrapper do sonner (`src/lib/toast.ts`). Validado: helpers com asserts (12/12) e leitura real de `leads` no Supabase.
- **Etapa 2 (Visão geral / dashboard) — CONCLUÍDA.** Tela `/` em `src/components/dashboard/*`: header com saudação por horário + filtro de período, 4 KPIs, clientes recentes, funil e os 2 gráficos Chart.js (doughnut de serviços, linha de novos clientes/dia). Tema integrado via context (`ThemeProvider`) — os gráficos recalculam cores ao alternar tema. `npm run build` passa.
- **Etapa 3 (Clientes / leads) — CONCLUÍDA.** Tela `/clientes` em `src/components/clientes/*`: busca por nome/telefone + filtro de período, tabela de leads e modal de detalhe (dados do lead + agendamentos + prévia da conversa). O clique nos "Clientes recentes" do dashboard agora também abre o modal. `npm run build` passa; validado via HTTP.
- **Etapa 4 (Conversas) — CONCLUÍDA.** Tela `/conversas` em `src/components/conversas/*`: inbox 3 colunas (lista · chat · perfil), abas Tudo/IA/Humano/Inativo com contagem, ordenação por última mensagem, badge de não-lidas (zera ao abrir via `update nao_lidas=0`), chat com mensagens agrupadas por dia, toggle de pausa da IA, envio otimista de mensagem (webhook n8n) com auto-pausa da IA, e painel de detalhes do cliente. `npm run build` passa; validado via HTTP.
- **Etapa 5 (Agenda) — CONCLUÍDA.** Tela `/agenda` em `src/components/agenda/*`: grade semanal (08–20h × 7 dias) com navegação de semanas, eventos posicionados por horário/minuto, linha do horário atual, modal de novo agendamento (clique numa célula ou "+ Novo") e modal de edição (status + exclusão). `npm run build` passa; validado via HTTP.
- **Etapa 6 (Campanhas) — CONCLUÍDA e depois REMOVIDA (jul/2026).** A tela existiu e funcionou; foi retirada porque a clínica não usa disparo em massa. Ver "Campanhas — REMOVIDA".
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

### 🗄️ O banco mudou MUITO em ago/2026 — leia antes de escrever query
Três ondas de mudança em poucos dias, e duas delas quebraram código que existia.

**1. Colunas REMOVIDAS de `leads`:** `score_ia`, `temperatura`, `tags` e `origem`. Não voltam. Saíram junto o `getTemp`, o `getTags`, o card SCORE IA (mostrava "—" para todo cliente) e o bloco TAGS das Conversas. ⚠️ **`agendamentos.origem` EXISTE** (valores `ia` ou nulo) — é outra coluna. O canal do lead é `canal`.

**2. Estrutura financeira criada e depois REMOVIDA.** Em 06/08 nasceram `procedimentos`, `pagamentos`, `pacotes`, `pacotes_vendidos`, `pacote_saldo`, `pacote_itens`, as views `vw_financeiro_atendimentos` / `vw_pacotes_saldo`, a função `financeiro_resumo(date,date)` e as colunas `agendamentos.procedimento_id` / `pacote_vendido_id`. **Tudo foi apagado pelo dono em 11/08** — a spec que veio junto trocava o layout aprovado por outro, e ele preferiu voltar. `agendamentos.valor` voltou a **0 preenchidos de 254**.
> O que ficou de aproveitável está nas mensagens dos commits `0c5b3bc`, `05a1261` e `9ea62e4`: a régua **previsto ≠ faturado ≠ recebido**, o `valor` como *snapshot* (nunca recalcular por join com preço de tabela, senão o passado muda quando o preço mudar) e o estorno como **valor negativo** (o saldo sobe sozinho; não existe "cancelar pagamento").

**3. Cadastro de lead — migration ESCRITA, NÃO APLICADA.** `supabase/migrations/20260811_leads_cadastro_completo.sql` adiciona `email, site, documento, empresa, nascimento, cep, logradouro, numero, complemento, bairro, cidade, uf, pais, anotacoes, etiquetas[]`. Aditiva e anulável. Enquanto não rodar, o cadastro devolve **42703** e a tela diz isso com todas as letras.
> ⚠️ **Não use `leads.memoria` para campo de formulário.** É da Laura: hoje guarda `{"preferencias":{"dias":[…],"horarios":[…]}}`. E não ressuscite nomes removidos — "como conheceu" foi para `anuncio_origem`, e as etiquetas são `etiquetas`, não `tags`.

**Tabelas com RLS ligada e ZERO policies** (só service role lê, sempre por rota de servidor): `documentos_lins`, `promocoes`, `fichas_avaliacao`. O cliente do navegador recebe **0 linhas** — se uma tela nova vier vazia, olhe isto primeiro.

### 💰 Preço vem do catálogo da clínica, nunca de tabela no código (ago/2026)
Os valores de avulso moram em **`documentos_lins`** — a MESMA base que a Laura lê no WhatsApp. Preço próprio no CRM faria a agente dizer um valor e a tela mostrar outro.

- **`src/lib/servicos.ts`** (puro): lê o preço do TEXTO do documento (`metadata` está vazia) e trata os formatos reais — fixo, `de X a Y` (média), `a partir de X` (piso), `X na clínica ou Y na residência` (o primeiro), e sem linha de preço (laser e cera cobram **por área**: média das 30 áreas, com os COMBOS excluídos senão o pacote infla a sessão).
- **`resolverServico`** devolve 4 precisões: `promocao` (título de promoção → preço do pacote) · `exato` · `familia` (texto genérico → média das variantes; "Limpeza de pele" tem 4 no catálogo) · `desconhecido` (**preço nulo, sem chute**).
- ⚠️ **Pacote não cai na média de avulso.** "Pacote 10 sessões de drenagem" virava R$ 125 pela família; custa 499,90. Sem promoção casada, fica sem preço — errar 4× pra menos engana mais que um vazio.
- **O ticket padrão de R$ 100 morreu.** Ele fazia 69 atendimentos entrarem por um número que nada sustentava. Hoje: 63% exato + 11% família + 1% promoção = **75% com fonte real**, 25% honestamente nulo, e o aviso na tela diz quantos são.
- Leitura por `/api/painel/servicos` (service role). Hook `useCatalogoServicos`.
- **Botox e Preenchimento não estão no documento** — 17 atendimentos sem preço. Adicionar lá resolve na tela e na Laura ao mesmo tempo.

### 📤 Envio de mensagem sai do SERVIDOR (ago/2026)
O envio quebrou em produção. Diagnóstico: DNS do webhook do n8n resolvia, mas **a porta 443 recusava conexão** — o host estava fora (controle: `example.com` 200, `api.github.com` 200 da mesma máquina). Não era CORS.

Mas o desenho antigo tinha três problemas ao mesmo tempo, e os três somem com a chamada saindo do servidor:
1. `fetch` do navegador para outro domínio com `Content-Type: application/json` **obriga preflight OPTIONS**;
2. a URL do webhook estava **no bundle** (`NEXT_PUBLIC_` + default fixo) — dava para disparar WhatsApp pela clínica sem login;
3. host fora do ar prendia a requisição sem mensagem de erro decente.

Hoje: `src/lib/evolution.ts` (`server-only`, timeout de 20s) → `/api/painel/enviar-mensagem` → o cliente chama a **nossa** rota (`src/lib/enviar-mensagem.ts`). `src/lib/n8n.ts` foi removido.

- **A rota GRAVA em `conversas` como `origem='humano'`.** Isso foi **medido**: mandei uma mensagem pela API, ela chegou no WhatsApp e **não** apareceu na tabela — o fluxo do n8n captura o que a dona digita no CELULAR, não o que sai pela API. Sem essa escrita, o enviado pelo CRM sumiria no refresh.
- A gravação vem **depois** do envio, e falhar nela não devolve erro: a cliente já recebeu, mandar reenviar seria pior. A tela avisa "enviada, mas não entrou no histórico".
- **Instância: `Laura Lins`** (`556195021845`, perfil "Lins Estética"). ⚠️ Existe uma instância chamada **`Agente Lins` que é do Cryo**, outro negócio — escolher pelo nome mandaria WhatsApp do número errado para cliente real.
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` — **sem `NEXT_PUBLIC_`**, e precisam ser cadastradas na Vercel.

### 💬 Formato do WhatsApp e composer (ago/2026)
`src/lib/formato-whatsapp.ts` converte `*negrito*`, `_itálico_`, `~riscado~` e ` ```mono``` ` numa **árvore**, não em HTML — a mensagem vem de terceiros e montar HTML com ela seria injeção. Quem desenha (`texto-whatsapp.tsx`) cria elementos React.
- A regra é que o marcador **cola no conteúdo**: `*texto*` formata, `* texto *` não. É o que impede um asterisco solto de comer a frase. 24 asserts nisso.
- O preview do inbox usa `textoLimpo` (lá não dá para estilizar), limpando **antes** de cortar em 60 — cortar primeiro deixaria um `*` órfão.
- O composer virou `<textarea>`: em `<input>` de uma linha o navegador **ignora** Shift+Enter. Enter envia, Shift/Alt/Ctrl+Enter quebram linha, e respeita o **IME** (durante composição de acento, Enter confirma o caractere e não pode enviar).

### Visão geral com abas + aba Negócios (ago/2026)
`src/components/visao-geral/visao-geral.tsx` é o container: UM cabeçalho, UM filtro de período, e as abas trocam só o corpo (**Negócios** e **Multiatendimento**). O `Dashboard` perdeu o header e recebe `period` por prop — trocar de aba não perde o recorte.

Layout novo isolado no prefixo `.neg-`: 5 cards, Dados diários (Chart.js, 3 séries) e Percentual por profissional; abaixo, Serviços mais vendidos e Por categoria. Três decisões que o separam do `.metric-card` das outras telas: **densidade** (cabem cinco lado a lado), **número em sans tabular** (Cormorant tem largura variável por dígito e faz o dinheiro dançar entre cards) e **contraste vindo do FUNDO**, não de sombra.

⚠️ **A rosca por profissional é SINTÉTICA** (hash do id) e tem selo dizendo isso — `profissional_id` é nulo em 100% dos agendamentos. Ela sai/volta por condição no DADO, não por comentário.

### Cadastro de lead completo (ago/2026)
`new-lead-modal.tsx` passou de 4 campos para 17, em abas (Contato, Dados pessoais, Endereço, Anotações). Lógica pura em `src/lib/lead-form.ts` — **53 asserts**: CPF com dígito errado, CPF repetido, CNPJ, fixo e celular, e o nascimento comparado em **texto** (`"1990-05-14"` como `Date` vira 13/05 em Brasília).
- **Telefone gravado em dígitos com DDI 55**, a mesma chave do upsert do n8n. Formatado, o cadastro de balcão viraria um SEGUNDO registro quando a cliente mandasse WhatsApp.
- Erro de validação **leva para a aba do campo** — "corrija os campos" com o campo escondido em outra aba trava a pessoa.
- CEP busca no ViaCEP ao completar 8 dígitos (ele serve `Access-Control-Allow-Origin: *`) e **não sobrescreve** o que já foi digitado.
- Tipografia: título em **sans**, não no Cormorant dos outros modais — serif atrapalha em formulário, onde os rótulos são sans. Canto do modal 20px → 14px.

### Agenda: catálogo no combobox e a grade da escala (ago/2026)
- O `<select>` de serviço tinha 10 nomes fixos no código; virou **combobox com busca** (`servico-combobox.tsx`), com os 38 serviços do documento, agrupados por categoria, buscando por nome, categoria e **sinônimo** ("virilha" acha depilação) e mostrando o preço à direita.
- **`HORA_GRADE_FIM` era 20 e APAGAVA turnos.** O editor de escala salva com `DELETE` + `INSERT` do que está pintado, e a leitura descartava em silêncio toda hora ≥ 20 — a Rozaria tem 20:00–21:00 em terça e quinta, então abrir a escala dela e salvar apagaria os dois turnos. Hoje é 21 (grade 8..20). O teste é de **ida e volta** com a escala real: pintar → faixas → pintar tem que devolver o mesmo conjunto.
- Para a Agenda abrir 20h de segunda a sexta falta **escalar alguém** nesse horário — é dado, não código.

### Aviso sonoro nas Conversas (ago/2026)
`src/lib/som.ts` gera o toque pela Web Audio API — sem arquivo, sem requisição. Só toca em INSERT com `origem='cliente'`. O escopo é estrutural: o código vive em `conversas.tsx`, que só monta em `/conversas`.
- A preferência é lida por **ref**, não por state: quem consulta é o handler do realtime, montado uma vez, que congelaria no primeiro valor.
- O navegador só libera áudio depois de um gesto — o contexto nasce suspenso e `resume()` fora de gesto é bloqueado. Destravo no primeiro clique/tecla.

### 🔴 Teto de 1.000 linhas do PostgREST (jul/2026) — a classe de bug mais traiçoeira daqui
O PostgREST devolve **no máximo 1.000 linhas por requisição e NÃO sinaliza quando corta**: sem erro, sem status diferente, sem aviso. `select()` sem `.limit()` não traz "tudo" — traz "até mil, e cala". **Já tinha quebrado em produção.**

- **Sintoma real:** o lead com **1.075 mensagens** (Mônica Lins) tinha o chat parando em 29/07 17:17 enquanto a última era 31/07 19:13 — **75 mensagens invisíveis**. A conversa subia no topo da lista com aviso de mensagem nova e o histórico parava no dia anterior. Ordenação **crescente** + corte = perde-se exatamente o que interessa.
- **Regra desta base:** ao escrever query, pergunte *"e se passar de mil?"*. Ordenação crescente é o caso perigoso (descarta o futuro/recente). E **paginar exige ordenação determinística** — sem `order` estável o Postgres pode devolver ordem diferente a cada página, duplicando umas linhas e perdendo outras; por isso toda chamada desempata por `id`/`lead_id`.
- **`src/lib/paginar.ts`** (`buscarTodasAsPaginas`): pagina por `.range()` até vir página curta. Sem dependência de cliente — serve o do navegador (`queries.ts`) e o de service role (`followup-db.ts`). Usada onde a tela precisa do conjunto **inteiro**, senão as contas mentem: `getLeads` (métricas/funil/conversão), `getUltimaConversaPorLead`, `getAgendamentos`/`getAgendamentosComLead` (crescente → perderia o futuro), `getProximasVisitas`, `listarFollowUps` (métricas por tipo).
- **Chat = cursor, não paginação completa.** `getConversasByLead(leadId, {antesDe, limite})` busca **decrescente com limite 50** e devolve o array **invertido**, então quem consome continua recebendo ordem cronológica. `useConversasDoLead` é `useInfiniteQuery`; o usuário sobe e o lote anterior vem. **Por cursor e não por `.range()`**: deslocamento obriga o banco a percorrer e descartar as linhas anteriores a cada página. E como o cursor é um *instante* e não uma posição, mensagem nova no fim não desloca as páginas antigas — é o que torna o refetch do realtime seguro.
- ⚠️ **Cursor usa `lte`, não `lt`**: existem mensagens com o **mesmo `enviado_em`** no mesmo lead (2 pares hoje), e `lt` perderia a gêmea da borda para sempre. A linha do cursor volta repetida e o container descarta por `id`.
- **Scroll ancorado** (`chat-panel.tsx`): o lote antigo entra ACIMA do que está na tela; `useLayoutEffect` empurra pela diferença de altura. Trocar de cliente / mensagem nova / envio continuam indo pro fim.
- **Realtime mirado**: o handler invalida `["conversas"]` (a view do inbox) e `["conversas","lead",<id do payload>]`. Invalidar o prefixo inteiro faria a conversa aberta refazer **todas** as páginas a cada mensagem de qualquer cliente. Sem `lead_id` no payload, cai no prefixo.
- `getConversas` foi **removida**: sem consumidor, e era o pior caso (`select *` ascendente sobre 5.672 linhas → devolveria as mais antigas de toda a base).
- **Não está resolvido para sempre:** `buscarTodasAsPaginas` garante *completude*, não *tamanho de payload*. Quando `leads` passar de alguns milhares, o certo é agregação no servidor (RPC) para as métricas, não baixar tudo.
- **Falta o índice composto `conversas(lead_id, enviado_em DESC)`** — hoje só existem `idx_conversas_lead` e `idx_conversas_enviado` separados. Migration escrita em `supabase/migrations/20260731_idx_conversas_lead_enviado.sql`, **não aplicada** (aguardando OK). Sem ele o cursor funciona, mas o Postgres ordena as linhas do lead a cada página em vez de caminhar o índice.

### Temas (jul/2026) — modo e paleta são coisas SEPARADAS
Antes existiam 2 temas e o atributo `data-theme="dark"` fazia dois trabalhos ao mesmo tempo: dizia *qual paleta* e dizia *que é escuro*. Isso travava o sistema em 2 temas — um terceiro exigiria duplicar toda regra `[data-theme="dark"] .x`.

- O `<html>` agora carrega **dois** atributos: **`data-mode="light|dark"`** (o estrutural: contraste, sombras, e o variant `dark:` do Tailwind) e **`data-theme="<id>"`** (a paleta). **Tema novo = só declarar os tokens `--vx-*`**, nada de CSS novo.
- `@custom-variant dark` passou a olhar `[data-mode="dark"]`. As 5 regras que eram `[data-theme="dark"] .x` viraram `[data-mode="dark"] .x`; as que eram só contraste (`.btn-primary`, `.filter-btn.active`, `.mini-cal-dia.sel`, bolha do agente) usam o token novo **`--vx-on-accent`** (texto sobre superfície pintada de accent) e sumiram os `#1a1814` espalhados — inclusive os `dark:text-[#1a1814]` do Tailwind nas Conversas, hoje `text-vx-on-accent`. A sidebar virou o token **`--vx-sidebar-bg`** (sempre escura, mas o tom acompanha a paleta).
- **Catálogo em `src/lib/tema.ts`** (`TEMAS`, `ehTema`, `modoDoTema`, `defDoTema`): id, label, descrição, `escuro` e as cores da miniatura. Fonte única — o `ThemeScript` **gera dele** o mapa id→modo do script inline (sem drift), e o seletor de Configurações renderiza a partir dele. Adicionar tema = 1 entrada aqui + 1 bloco de tokens no CSS.
- **`ThemeProvider`** expõe `{ theme, setTheme }` (era `toggleTheme` binário). Ids em inglês (`light`/`dark`/`graphite`) **de propósito**: são os valores já gravados no `localStorage` de quem usa, então ninguém perde a preferência.
- **Tema novo: `graphite` ("Grafite")** — mesmo modo escuro, base **neutra** (cinzas levemente frios, sem tingimento). É a neutralidade que libera as cores: no bege escuro, verde/âmbar/vermelho brigam com o marrom do fundo e saem lavados. O dourado continua sendo a assinatura e, por contraste com o cinza frio, fica mais forte que nos outros dois. Extraído da referência do DataCrazy que o dono mandou.
- **`ui/sonner.tsx` deixou de usar `next-themes`**: sem provider dele, `useTheme()` caía em `"system"` e o toast seguia o **sistema operacional**, não o painel. Agora lê o nosso provider e passa o *modo*.

### Campanhas — REMOVIDA da interface (jul/2026)
A tela `/campanhas` foi retirada a pedido do dono: a clínica não usa disparo em massa. Saíram a rota, `src/components/campanhas/*`, `src/lib/campanha.ts`, o item do menu, `useCampanhas`, as queries (`getCampanhas`, `createCampanha`, `insertCampanhaEnvios`, `updateCampanhaTotal`, `getLeadsParaCampanha`), os tipos (`Campanha`, `CampanhaEnvio`, `CampanhaStatus`, `EnvioStatus`) e os 17 seletores `.camp-*` do CSS.

**As TABELAS `campanhas` e `campanha_envios` CONTINUAM no banco** — estavam vazias (0 linhas) e não foram dropadas: derrubar tabela é irreversível e a decisão foi só sobre a interface. A coluna `leads.aceita_campanha` também fica (é o opt-out do lead). Para reativar, o histórico do git tem a tela inteira.

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
**Julgue pelo CONTEÚDO, não pelo nome**: em dev o Turbopack mantém o mesmo nome (`src_app_globals_<hash>.css`) mesmo com o conteúdo mudado — hash igual não prova nada. Se a regra nova **não está** no arquivo servido, é cache: o fonte está certo e o servidor está velho. Antes de matar, `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` mostra as linhas de comando (evita derrubar node alheio); `taskkill //IM node.exe //F` mata os órfãos. Se o `rm -rf .next` reclamar "Directory not empty", é porque ainda há `node` segurando o arquivo — **mate primeiro, apague depois**.

### Dashboard (Etapa 2)
- Estrutura em `src/components/dashboard/`: `dashboard.tsx` (container: fetch `getLeads`+`getAgendamentos`, estado de período e saudação), `metrics-grid.tsx`, `recent-leads.tsx`, `funnel.tsx`, `service-chart.tsx`, `timeline-chart.tsx`.
- **Tema dos gráficos**: `ThemeProvider` (`src/components/theme-provider.tsx`) virou a fonte única do tema (substituiu `lib/use-theme.ts`, removido). O toggle vive na topbar; os gráficos consomem o context e releem as CSS vars (`getChartStyle` em `src/lib/chart.ts`) ao trocar de tema.
- **Charts SSR**: `ServiceChart`/`TimelineChart` só renderizam após `mounted` (gate) para não acessar `document`/`getComputedStyle` no servidor.
- **"Consultas agendadas" — AJUSTADO (jun/2026), diverge do legacy de propósito.** Agora conta **linhas de `agendamentos`** no período (cada marcação = 1), excluindo `cancelado`, filtrando por **`agendamentos.criado_em`** (quando a consulta foi MARCADA), não por `data_agendamento`. Intenção: "quantas consultas foram agendadas neste período". A **"Receita estimada"** usa o MESMO conjunto (mesmo filtro `criado_em`, sem cancelados, com `valor`) para receita e contagem baterem. `agendamentos.criado_em` existe no banco (`timestamptz`, `default now()`, `NOT NULL`, 100% preenchido). A **"Taxa de conversão"** NÃO mudou: continua sendo de *leads* (`agendado`+`convertido`)/total de leads. Receita segue R$ 0,00 enquanto `agendamentos.valor` vier vazio (n8n).
- **Pendência local**: os itens de "Clientes recentes" ainda não abrem o modal de lead (não há clique) — isso entra na Etapa 3 junto com `openLeadModal`.

### Camada de dados (Etapa 1)
- **Tipos** (`src/types/db.ts`): `Lead`, `Conversa`, `Agendamento` (+ `AgendamentoComLead` para o join da Agenda), `Campanha`, `CampanhaEnvio`. Status como unions com fallback de string (`Loose<>`), pois o n8n pode gravar valores fora da lista.
- **Queries** (`src/lib/queries.ts`): `getLeads`, `getLeadById`, `getAgendamentos`, `getAgendamentosComLead`, `getAgendamentosByLead`, `getConversas`, `getConversasByLead`. Espelham as queries do legacy (mesmas ordenações/joins) e lançam em erro.
- **Helpers** (`src/lib/format.ts`): `getInitials`, `getAvatarColors`/`AVATAR_PALETTE`, `fmtDate`, `getRelativeTime`, `limparServico`, `formatTelefone`, `statusBadgeClass`. (`src/lib/date.ts`): `getDateRange`, `filterByDate`. Portados 1:1 do legacy.
- **Componentes** (substituem os geradores de HTML do legacy): `Avatar` (`renderAvatar` — foto com fallback p/ iniciais) e `StatusBadge` (`badgeHtml`). CSS de `.avatar`/`.badge*`/`.loading`/`.spinner`/`.empty` portado para `globals.css`.

### Camada de dados com cache (React Query, jul/2026 — em migração incremental)
- **Motivo**: cada tela fazia `useState + useEffect(fetch on mount)`, refazendo os mesmos `select` a cada navegação, sem cache. Adotamos **TanStack Query** por cima das queries existentes (não altera `queries.ts` nem o Supabase).
- `QueryProvider` (`src/components/query-provider.tsx`) no `layout.tsx` (envolve `ThemeProvider`): `staleTime` 30s (navegar não refaz fetch), `refetchOnWindowFocus:false`, `retry:1`, e **toast de erro global** via `QueryCache.onError` (some o try/catch por tela).
- Hooks em `src/lib/hooks.ts`: `useLeads`, `useAgendamentos`, `useAgendamentosComLead` (key `['agendamentos','com-lead']`), `useConversas`. queryKeys dos agendamentos compartilham o prefixo `['agendamentos']` (invalidar o prefixo pega lista com/sem join).
- **Status: as 5 telas migradas.** Dashboard/Clientes usam `useLeads`; Agenda usa `useAgendamentosComLead`+`useLeads`; Conversas usa `useLeads`+`useConversas`+`useAgendamentos`. Após mutações, as telas chamam `qc.invalidateQueries` (ex.: Agenda invalida `['agendamentos']`+`['leads']`).
- **Mutações otimistas (Conversas)**: `setLeads`/`setConversas` foram redefinidos como `qc.setQueryData(['leads'|'conversas'], updater)` — o corpo das ações (`openConversa`/`toggleIA`/`enviarMensagem`) não mudou (já usavam a forma `set(prev => ...)`). Fonte única no cache.
- **Realtime — ATIVO (jul/2026)**: `conversas.tsx` tem um `supabase.channel('conversas-crm')` que invalida `['conversas']`/`['leads']` em `postgres_changes`. As tabelas `conversas` e `leads` foram adicionadas à publicação `supabase_realtime` (migration `enable_realtime_conversas_leads`), então o inbox **atualiza sozinho** quando o n8n/cliente grava. (RLS liberado p/ anon, então o cliente do browser recebe os eventos.)

### Decisões de arquitetura (Etapa 0)
- **Navegação por rotas reais do App Router** (não SPA com `showPage`): `/visao-geral`, `/clientes`, `/conversas`, `/agenda`, `/promocoes`, `/follow-ups` (a raiz `/` é o site institucional). O `AppShell` (`src/components/app-shell.tsx`) é o chrome comum; o item ativo vem de `usePathname`. Config das telas em `src/lib/nav.ts`.
- **Tailwind v4 (config CSS-first via `@theme`)**, não há `tailwind.config.ts`. Tokens em `src/app/globals.css`.
- **Design tokens da marca sob prefixo `--vx-*`** (ex.: `--vx-surface`, `--vx-accent`) para não colidir com os tokens semânticos do shadcn. Expostos como utilitários Tailwind: `bg-vx-surface`, `text-vx-accent`, `border-vx-border2`, etc. Os tokens do shadcn (`--background`, `--primary`, `--border`, `--muted`, `--accent`…) **derivam** da paleta `--vx-*`, então os componentes shadcn já saem na estética bege/dourado.
- **Tema** — ver "Temas (jul/2026)" abaixo. Persistido em `localStorage` (`vorax-theme`); script anti-flash (`ThemeScript`) nos route groups do CRM.
- **Fontes** via `next/font/google` em `layout.tsx`: Cormorant Garamond (`--font-cormorant`, serif/títulos), Jost (`--font-jost`, texto), JetBrains Mono (`--font-jetbrains`, mono).
- **CSS do chrome** (sidebar/topbar/nav mobile) portado fielmente do legacy para `globals.css` (com `var(--X)` → `var(--vx-X)`). Os componentes das telas (próximas etapas) usam Tailwind/shadcn.
- **Ícones da navegação (jul/2026)**: os glifos unicode do menu foram trocados por **line icons do `lucide-react`** (componentes em `src/lib/nav.ts`): Visão geral=`LayoutDashboard`, Clientes=`Users`, Conversas=`MessageCircle`, Agenda=`CalendarDays`, Promoções=`Tag`, Follow-ups=`Undo2`. Renderizados com `size={20}` e `strokeWidth={1.5}`. Cor via token da paleta: `.nav-icon { color: var(--vx-accent) }` com `opacity` 0.4 (normal) → 0.7 (hover) → 1 (ativo), então acompanha claro/escuro. O bottom-nav mobile usa os mesmos ícones (herda a cor de `.bottom-nav-item`: muted/accent). Só a navegação foi trocada; os demais ícones/emojis do sistema seguem como estavam.
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

Helpers compartilhados no legacy (virar utils/components): `renderAvatar`, `getInitials`, `badgeHtml`, `formatTelefone`, `fmtDate`, `getRelativeTime`, `getDateRange`, `filterByDate`, `showToast`, `showPage`, `toggleTheme`, `limparServico`.

## Banco de dados (Supabase — JÁ EXISTE, não recriar)
URL do projeto: `https://sflpxenfyewefzwizimf.supabase.co` (a anon key vai em variável de ambiente, ver abaixo).
Timezone do projeto: America/Sao_Paulo.

Tabelas (15 hoje; as 5 originais primeiro). ⚠️ O schema MUDOU em ago/2026 — ver "O banco mudou MUITO" acima antes de escrever query:
- **leads** — chave de negócio é `telefone` (único, chave de upsert do n8n). Hoje: `id`, `nome`, `telefone`, `status` (novo/cliente), `canal`, `foto_url`, `nao_lidas`, `ia_pausada`, `pausada_em`, `pausada_por`, `motivo_pausa`, `resumo_ia`, `resumo_atualizado_em`, `aceita_campanha`, `anuncio_origem`, `memoria` (jsonb — **é da Laura**, não usar para campo de formulário), `ultima_interacao`, `criado_em`, `atualizado_em`. ⚠️ `score_ia`, `temperatura`, `tags` e `origem` foram REMOVIDAS em ago/2026.
- **conversas** — histórico de mensagens. Campos: `id`, `lead_id` (FK), `mensagem`, `origem` ('cliente' | 'agente' | 'humano'), `enviado_em`.
- **agendamentos** — Campos: `id`, `lead_id` (FK), `servico`, `data_agendamento`, `duracao_min`, `status` (pendente/confirmado/cancelado/realizado), `origem`, `valor` (existe na tabela; hoje vem vazio porque o n8n ainda não preenche — a "Receita estimada" depende disso).
- **campanhas** — ⚠️ **sem interface desde jul/2026** (a tela foi removida; a tabela ficou, vazia). `id`, `nome`, `mensagem`, `publico`, `status` (rascunho/enviando/concluida/pausada), `total`, `enviados`, datas.
- **campanha_envios** — ⚠️ **idem, sem interface**. Fila: `id`, `campanha_id` (FK), `lead_id` (FK), `telefone`, `nome`, `status`, unique(campanha_id, lead_id).

As demais (criadas fora deste repo, pelo n8n ou por migration daqui):
- **profissionais**, **profissional_horarios**, **profissional_bloqueios** — escala que alimenta `agenda_slots` / `agenda_checar`. Ver "Agenda".
- **promocoes** — o que a Laura oferece. **RLS ligada SEM policy**: só service role, por rota de servidor.
- **documentos_lins** — catálogo de 38 serviços + preços, em texto. Mesma base que a Laura lê. **RLS ligada SEM policy.**
- **fichas_avaliacao** — dado de saúde. **RLS ligada SEM policy.**
- **follow_ups** (+ view `follow_ups_resultado`) — disparos do agente.
- **dias_laser** — datas de Laser Day.
- **conversa_ultima_por_lead** (view) — 1 linha por lead, para o inbox.

RLS liberado para anon/authenticated (single-tenant). Não alterar schema sem necessidade; se precisar, registrar aqui e gerar migration.

## Variáveis de ambiente (.env.local)
- `NEXT_PUBLIC_SUPABASE_URL` = a URL acima
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = a anon key (pegar no painel do Supabase; NUNCA commitar a service_role key)
- `SUPABASE_SERVICE_ROLE_KEY` — sem `NEXT_PUBLIC_`. Lê o que tem RLS sem policy.
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` — envio de WhatsApp. **Sem `NEXT_PUBLIC_`**: a chave manda mensagem em nome da clínica. ⚠️ Precisam estar cadastradas **na Vercel**, senão o envio quebra em produção.

## O que NÃO está neste repositório
- O agente Laura, o FAQ, o Agente Agenda, os fluxos: tudo isso vive no **n8n** (nuvem), não aqui. Este front só LÊ e ESCREVE no Supabase. Não tentar implementar o agente aqui.
- Mudanças de prompt/fluxo do agente são feitas fora deste projeto.

## Pendências conhecidas (NÃO são bugs da migração; herdadas do legacy)
- **Migration do cadastro de lead NÃO aplicada** (`20260811_leads_cadastro_completo.sql`) — sem ela o salvar devolve 42703.
- **Índice composto `conversas(lead_id, enviado_em DESC)` NÃO aplicado** (`20260731_idx_conversas_lead_enviado.sql`).
- **`/privacidade`**: a constante `CONTATO` está VAZIA. Não divulgar o link antes de preencher.
- **Botox e Preenchimento** não existem em `documentos_lins` — 17 atendimentos sem preço.
- **Ninguém escalado em 20–21 nas segundas, quartas e sextas** — a Agenda mostra FECHADO às 20h nesses dias. É dado, não código.
- "Receita estimada" mostra R$ 0,00 porque `agendamentos.valor` vem vazio (o n8n não preenche). Migrar como está; resolver depois.
- ~~"Consultas agendadas"~~ **RESOLVIDO (jun/2026):** agora conta linhas de `agendamentos` (não leads), por `criado_em`, sem cancelados; "Receita estimada" usa o mesmo filtro. Ver detalhe na seção "Dashboard (Etapa 2)".
- ~~Inbox não tem realtime~~ **RESOLVIDO (jul/2026):** Supabase Realtime ativo em `conversas`/`leads` + invalidação do cache React Query no `conversas.tsx`. Ver "Camada de dados com cache".

## Como manter este arquivo
Ao concluir uma etapa de migração ou tomar uma decisão de arquitetura, ATUALIZE este CLAUDE.md (seção de estado e pendências). Este arquivo é a memória do projeto; mantê-lo curado evita perda de contexto entre sessões.
