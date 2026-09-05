# Meraki — plataforma SaaS para clínicas

## O que é

**Meraki** é um SaaS multi-clínica: um painel único que atende várias clínicas
ao mesmo tempo, cada uma vendo só os próprios dados. Cada clínica é um
**tenant**. Um agente de IA no WhatsApp (roda no **n8n**, fora deste
repositório) atende os clientes e grava no mesmo banco que este front lê.

A **LINS Estética Avançada** (Brasília) é a clínica nº 1 — o tenant `lins` já
existe no banco, com profissionais, escala e procedimentos cadastrados. **Os
dados de operação dela ainda NÃO foram migrados** (`leads`, `conversas`,
`agendamentos` estão vazios) e ela segue rodando no painel antigo, em **outro
repositório e outro banco**. Nada aqui pode tocar naquilo.

Este repositório nasceu de um clone daquele painel. Boa parte do código ainda
fala com o schema antigo — ver **"O código ainda não conhece este banco"**, que
é a primeira coisa a ler antes de escrever qualquer query.

---

## A regra de ouro

> **O navegador nunca escolhe o tenant. Ele informa; o banco valida.**

Qualquer código que aceite `tenant_id` do cliente e o use sem passar por
`tenant_valido()` é **bug de segurança**, não questão de estilo. Um `tenant_id`
vindo do corpo de um request é um palpite do cliente até o banco confirmar.

Isso tem duas leituras práticas, e a diferença entre elas é tudo:

**Leitura com anon key + sessão do usuário** (navegador, ou `supabase-server.ts`)
→ a RLS já filtra por `meus_tenants()`. **Não acrescente `where tenant_id`
manualmente.** É redundante, e pior: mascara o erro. Se a policy quebrar, o
filtro manual esconde o vazamento em vez de deixá-lo aparecer.

**Leitura com `service_role`** → **ignora RLS por completo.** Toda rota que usa
`SUPABASE_SERVICE_ROLE_KEY` precisa derivar o tenant da sessão e filtrar
explicitamente. Se a rota recebe `tenant_id` no corpo, valide com
`tenant_valido()` **antes** de qualquer consulta.

E a regra que sustenta as duas: **`service_role` só existe em route handler.**
Nunca em componente, nunca em código que o navegador possa importar.
`src/lib/supabase-admin.ts` tem `import "server-only"` no topo justamente para
o build quebrar se alguém tentar.

---

## Banco de dados

Projeto Supabase **`hcexbbmgfekpaakerfys`**. Timezone America/Sao_Paulo.

**31 tabelas** (conferido em 29/ago/2026 — eram 20 quando este arquivo nasceu;
`kanban_colunas`, `campanhas`, `campanha_envios`, `comprovantes`, `dias_laser`,
`envios_proativos` e o jornal de eventos entraram depois). Todas com RLS ligada
e `tenant_id uuid NOT NULL`; a exceção é `prompt_base`, que é global (o
prompt-base do agente, igual para todas as clínicas, leitura liberada a
`authenticated`).

⚠️ **O banco anda mais rápido que este arquivo.** A lista abaixo descreve o
núcleo; antes de afirmar que algo não existe, confira — foi assim que
`documentos_lins` continuou no código por semanas depois de a tabela virar
`documentos`.

Toda tabela com `tenant_id` tem **uma** policy, sempre a mesma forma:

```sql
FOR ALL TO authenticated
USING      (tenant_id IN (SELECT meus_tenants()))
WITH CHECK (tenant_id IN (SELECT meus_tenants()))
```

`anon` não lê nada. Sem sessão, o navegador recebe **zero linhas** — se uma
tela vier vazia, olhe isto primeiro.

### As tabelas

**Tenancy** — `tenants` (id, slug, nome, ativo) · `tenant_config` (endereço,
fuso, duração padrão, regras de sábado/domingo) · `usuarios_tenant` (`user_id` ×
`tenant_id` × `papel` — é o que liga uma conta do Auth a uma clínica).

**Agente** — `prompt_base` (global, versionado) · `tenant_blocos_prompt`
(blocos por clínica, com ordem) · `canais` (WhatsApp/Instagram por clínica;
**sem credencial aqui** — chave da Evolution e token da Meta ficam em env,
indexados por `identificador`) · `documentos` (base de conhecimento, com
`embedding` e `fts`).

**Operação** — `leads` · `conversas` (com `msg_id` e os campos `media_*`) ·
`agendamentos` · `promocoes` · `follow_ups` · `fichas_avaliacao`.

**Envios automáticos** — `envios_regras` (PK composta `(tenant_id, tipo)`,
quatro linhas semeadas: lembrete, retomada, compromisso, reativacao). Toda
mensagem que o sistema manda sozinho passa por **um porteiro só**,
`envio_pode(tenant, lead, tipo)` — e essa função **não tem regra dentro**: lê
tudo desta tabela. ⚠️ A tela SEMPRE faz `update`, nunca `insert`: tipo sem
linha faz `envio_pode` recusar ("sem regra configurada"), então uma linha
inventada só produziria envio que nunca sai. `dias_semana` é `smallint[]` com
**domingo = 0**, a mesma origem de `extract(dow)` — trocar isso deslocaria a
semana inteira sem erro nenhum. A dispensa individual é `leads.dispensa_envios`
(`text[]`), e `envio_pode` a confere ANTES de pausa, opt-out e frequência:
**manual sempre vence**.

**Requisitos** — `requisitos` (nome, `descricao`, `validade_dias`, `bloqueia`,
`url_base`) · `requisito_procedimentos` (a matriz: qual procedimento exige qual
requisito) · `requisito_campos` (as perguntas, com `chave`, `tipo` e
`alerta_se`) · `requisito_respostas` (respostas em `jsonb`, `alertas`, `token`,
`valido_ate`). O modelo em uma frase: **antes de X acontecer, Y precisa estar
respondido e válido.** Nada no código sabe o que é uma ficha de
contraindicação — as perguntas e a regra de alerta vêm todas do banco, e é isso
que deixa uma odonto configurar "usa anticoagulante" sem tocar em código.

**Kanban** — `kanban_colunas` (uma linha por status × clínica: `rotulo`,
`descricao`, `ordem`, `visivel` e `cor`). ⚠️ `cor` guarda **nome de token**, e
no vocabulário do desenho (`--st-erro`), não no da casa (`--mk-st-erro`).
`tokenDaColuna()` em `src/lib/kanban.ts` traduz **por lista fixa** — o valor vem
do banco e termina dentro de um `var()`, e token inexistente não quebra nada:
a cor só some.

**Agenda e catálogo** — `profissionais` · `profissional_horarios` (padrão
semanal) · `profissional_excecoes` (exceção por data) · `profissional_bloqueios`
· `procedimentos` (com `duracao_min` e `preco`) · `procedimento_apelidos`
(sinônimos: "virilha" acha depilação) · `profissional_procedimentos` (linha
ausente = a profissional **não** faz aquele procedimento).

**Duas views** (29/ago/2026): `follow_ups_resultado` e
`conversa_ultima_por_lead`. As duas já foram inexistentes e este arquivo dizia
que eram — não são mais. O bucket `midia-conversas` é criado pela migration
`20260825_bucket_midia_conversas.sql`.

### Em que estado uma conversa está

`src/lib/estado-conversa.ts` é a fonte única. **Cinco estados, e os cinco saem
de coluna que existe** — a ordem abaixo é prioridade, e eles formam uma
partição: cada conversa cai em exatamente um, e as contagens da barra somam o
total.

| estado | de onde sai |
|---|---|
| `inativo` | `ultima_interacao` (ou `criado_em`) há mais de 30 dias |
| `aguardando` | `ia_pausada = true` **e** `nao_lidas > 0` |
| `atendendo` | `ia_pausada = true` e nada por ler |
| `agendado` | tem `agendamentos` `pendente`/`confirmado` no futuro |
| `ia` | o resto |

⚠️ **Três estados do desenho NÃO existem no banco, e o chip deles ficou de
fora.** `resolvido` — `leads.status` é texto livre (sem CHECK) e o ciclo de
vida gravado é novo/cliente/inativo; não há "fechou bem". `erro` —
`motivo_pausa` é texto livre e hoje só o painel escreve nele, com duas frases
fixas; ler erro dali seria inventar enum sobre texto livre. `arquivado` — não
existe como ação; o que existe é `inativo`, e o chip usa esse nome de propósito,
porque dizer "arquivado" prometeria um botão que não há.

Os **tokens** dos três continuam definidos: a Agenda usa `resolvido`/`erro` nas
badges e os KPIs usam os dois nos ícones. O que não existe é o chip.

### Quem pode chamar o quê

```
anon (formulário público, SEM sessão — o token na URL é a credencial)
  requisito_formulario(p_token uuid)   uma linha por pergunta
  requisito_responder(p_token, jsonb)  grava e devolve ok, alertas, valido_ate

authenticated (painel, via anon key + RLS)
  minhas_clinicas()          clínicas desta conta (tenant_id, slug, nome, papel)
  tenant_valido(uuid)        valida um tenant contra a sessão → devolve o uuid
  painel_agenda(...)         agenda; o tenant vem da sessão
  meus_tenants()             usada dentro das policies

service_role (só n8n e route handler)
  agenda_consultar / agenda_marcar / agenda_alterar
  montar_prompt / tenant_por_canal / procedimento_resolver / agenda_escala

⚠️ CONCEDIDAS A `authenticated`, MAS NÃO VALIDAM O TENANT — só de route handler
  kanban(p_tenant, de, ate)               cartões, já agrupados e ordenados
  kanban_mover(p_tenant, agend, status, por)  move e devolve codigo + motivo
  taxa_no_show(p_tenant, de, ate)         realizados, faltas, cancelamentos
```

⚠️ **O token de requisito é UUID.** `requisito_formulario(p_token uuid)` não
devolve zero linhas para um link malformado: levanta `22P02 invalid input
syntax for type uuid`. Sem a guarda `ehToken()` antes da chamada, "link errado"
chega na tela como erro de sistema. Token inexistente, esse sim, devolve zero
linhas — e a tela recusa **sem dizer por quê**: distinguir "expirado" de
"inexistente" conta a quem estiver adivinhando qual das duas ele acertou.

⚠️ **`requisito_responder` devolve `alertas`, e eles NUNCA vão para a tela da
cliente.** São informação clínica para a equipe (o alerta é o texto da própria
pergunta). Dizer "você tem 2 alertas" assusta alguém que não tem contexto para
interpretar. A tela final é confirmação e só.

⚠️ **As três do Kanban são a mesma armadilha do `agenda_consultar`, e uma delas
ESCREVE.** São `SECURITY DEFINER` (ignoram RLS), recebem `p_tenant uuid` cru,
não chamam `tenant_valido()` — e estão concedidas a `authenticated`. Chamá-las
do navegador deixaria qualquer conta logada ler *e mover* a agenda de qualquer
clínica, trocando um uuid no console. Por isso o Kanban passa por
`/api/painel/kanban`, onde `resolverTenant()` valida antes. **Não chame
`supabase.rpc("kanban…")` de componente.**

**`agenda_consultar` não é chamável pelo painel de propósito**: ela recebe
`p_tenant` e **não valida**, porque quem a usa é o n8n, que já resolveu o tenant
pelo canal. No painel, use **`painel_agenda`**, que é a mesma função embrulhada
em `tenant_valido()`:

```sql
painel_agenda(p_de, p_ate, p_servico, p_apenas_livres, p_limite, p_tenant)
  → agenda_consultar(tenant_valido(p_tenant), p_de, p_ate, p_servico, null, …)
```

`p_tenant` é o **último** parâmetro e tem default `null`. Passar o tenant
escolhido no seletor é seguro **por causa** do `tenant_valido()` no meio — e é
exatamente o desenho que a regra de ouro descreve: o cliente informa, o banco
confere.

⚠️ **`tenant_valido` foi corrigida em 29/ago/2026** (migration
`20260829_tenant_valido_sem_min_uuid.sql`). Ela resolvia o caso implícito com
`min(tenant_id)`, e **o Postgres não tem agregado `min(uuid)`** — a linha roda
antes da checagem de `n`, então `tenant_valido(null)` levantava
`42883 function min(uuid) does not exist` **sempre**. Como é `null` que chega
quando a conta tem uma clínica só (sem cabeçalho `x-meraki-tenant`), isso
derrubava com 500 **todas as onze rotas** que passam por `resolverTenant`. As
telas que leem pelo navegador escapavam porque vão por RLS. Hoje é
`(array_agg(tenant_id order by tenant_id))[1]` — funciona com uuid e é
determinístico.

**`tenant_valido(p_tenant)`**:
- `null` → devolve o tenant da conta (para quem só tem um);
- um uuid → confere em `usuarios_tenant` contra `auth.uid()` e **levanta
  exceção** (`acesso negado a esta clinica`) se não bater.

---

## ⚠️ O código ainda não conhece este banco

O clone veio do painel single-tenant. Leia `INVENTARIO.md` antes de mexer em
qualquer query — o levantamento completo está lá. O resumo do que **não existe**
neste banco e o código continua chamando:

| O código chama | Situação (conferido em 29/ago/2026) |
|---|---|
| `agenda_slots`, `agenda_checar`, `agenda_profissionais_na_escala` | **continuam não existindo** — o equivalente é `painel_agenda` |
| ~~`documentos_lins`~~ | **resolvido** — a query aponta para `documentos` |
| `conversa_ultima_por_lead` (view do inbox) | **existe** |
| `follow_ups_resultado` (view) | **existe**, com as 13 colunas que o código lê |

E colunas que trocaram de nome — quebram com `42703` na escrita e silenciosamente
na leitura:

| Código espera | Banco tem |
|---|---|
| `agendamentos.servico` | `servico_texto` (+ `procedimento_id`) |
| `agendamentos.origem` | — removida |
| `agendamentos.profissional` (texto) | `profissional_id` (uuid) |
| `leads.anuncio_origem` | `anuncio_texto` / `_id` / `_url` / `_app` / `_em` |
| `leads` com campos de endereço | não existem — só `email`, `instagram`, `nascimento`, `anotacoes`, `etiquetas` |
| `fichas_avaliacao.status` / `.alertas` / `.tipo` | `tem_alerta boolean` |
| ~~`promocoes.valor_promocional` / `.condicao` / `.dia_semana`~~ | **existem**, mas `valor_promocional` é **`numeric`**, e o código a tratava como texto — ver os defeitos conhecidos |

**Todo `insert` precisa de `tenant_id`** — é `NOT NULL` em 19 das 20 tabelas, e
nenhum insert do código atual preenche.

---

## Autenticação e tenant

- **Sessão em cookie** via `@supabase/ssr`. `src/lib/supabase.ts` exporta
  `supabase` (navegador, `createBrowserClient`); `src/lib/supabase-server.ts`
  exporta `getSupabaseServer()` e `getUsuario()` (servidor, anon + RLS).
- **`src/middleware.ts`** exige sessão em tudo, exceto `/login`, `/ficha/*`,
  `/api/ficha/*`, `/api/site/*` e as rotas exatas `/` e `/privacidade`.
  Usa **`getUser()`, não `getSession()`** — o segundo confia num cookie
  forjável. Página sem sessão → 307 `/login`; **API sem sessão → 401 JSON**
  (redirecionar um endpoint devolveria HTML de login como resposta da chamada).
- **Não existe tela de cadastro.** Conta nova = criar no painel do Supabase
  (Authentication → Users → Add user, com Auto Confirm) **e** inserir a linha
  correspondente em `usuarios_tenant` — sem ela, `tenant_valido()` levanta
  `sem clinica vinculada a esta conta` e a conta não vê nada. A policy de
  `usuarios_tenant` é só `SELECT`: o vínculo se cria por SQL/service_role, não
  pelo painel.
- **Seletor de clínica** (`src/components/tenant-provider.tsx` +
  `tenant-selector.tsx`): carrega `minhas_clinicas()` uma vez. Uma clínica →
  sem seletor visível, tenant implícito. Mais de uma → seletor no topo da
  sidebar, escolha persistida em `localStorage`. O valor persistido **nunca** é
  fonte de verdade sozinho: vai no cabeçalho e o banco valida.

### Como o tenant chega no servidor

Um caminho só, e é o que torna a regra de ouro verificável:

```
navegador   fetchPainel()          src/lib/api-painel.ts
              ↳ cabeçalho x-meraki-tenant (da escolha no localStorage)
servidor    resolverTenant(req)    src/lib/tenant-server.ts
              ↳ getUser()          sessão existe?
              ↳ minhas_clinicas()  universo permitido desta conta
              ↳ tenant_valido()    o banco confirma, ou levanta exceção
rota        .eq("tenant_id", …)    com o valor já validado
```

**Toda chamada do painel usa `fetchPainel`, não `fetch` cru.** Esquecer o
cabeçalho não quebra a tela de quem tem UMA clínica — o servidor resolve o
implícito — e é justamente isso que torna o esquecimento difícil de notar:
funciona no desenvolvimento e falha só na conta que atende duas.

⚠️ **`tenant_valido(null)` não é usado para resolver o implícito.** Com mais de
um vínculo, aquela função pega a primeira linha que o Postgres devolver — sem
ordenação e sem erro. `resolverTenant` responde `400 tenant_nao_informado` em
vez de deixar a conta ver a clínica errada achando que funcionou.

**A vitrine é a exceção, e a única.** `/api/site/agenda-demo` é pública e usa
service_role, então não há sessão de onde derivar tenant: ele vem de
`MERAKI_TENANT_DEMO` (slug, no servidor) via `tenantDaVitrine()`. Aceitar o
slug por querystring deixaria qualquer visitante ler a agenda de qualquer
cliente do Meraki trocando uma palavra na URL. Sem a variável, a rota responde
`503 indisponivel` — o padrão seguro é não mostrar nada, não mostrar a
primeira que aparecer.

⚠️ **Duas armadilhas de build, e elas se contradizem:**

1. `useSearchParams()` exige `<Suspense>`. O build *compila* e só o **export**
   quebra — grepar `✓ Compiled` esconde a falha. Aqui o **exit code pega**.
2. **Erro de CSS NÃO derruba o build.** Medido em ago/2026: um seletor vazio
   (`{` sem nada antes) faz o `next build` imprimir `Invalid empty selector`
   e **sair com código 0**. Com o cache do Turbopack quente, ele nem imprime.
   O `next dev` falha, e a tela some para quem abrir.

   Ou seja: o exit code é necessário e **não é suficiente**. Para CSS existe
   `npm run verificar:css` (`scripts/verificar-css.mjs`), que pega seletor
   vazio, combinador solto, chave desbalanceada **e classe nomeada sem regra**
   — os defeitos que uma edição por script deixa para trás. Rode depois de
   qualquer alteração em massa no `globals.css`.

---

## Ambiente

```
NEXT_PUBLIC_SUPABASE_URL=https://hcexbbmgfekpaakerfys.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # sem NEXT_PUBLIC_, jamais
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=
MERAKI_TENANT_DEMO=                 # slug da clínica da vitrine (opcional)
```

São essas sete, e só essas. As três da Evolution **não** levam `NEXT_PUBLIC_`:
a chave manda mensagem em nome da clínica.

**Trava de banco** (`src/lib/env.ts`, importada pelo `next.config.ts`): a
aplicação **se recusa a subir** se `NEXT_PUBLIC_SUPABASE_URL` não contiver
`hcexbbmgfekpaakerfys`, com a mensagem `banco errado — este painel é do Meraki`.
Parece exagero; é a única defesa automática contra este painel escrever no banco
de produção da clínica. **Não afrouxe essa checagem** para "testar rápido contra
o banco antigo".

---

## Storage

Bucket **`midia-conversas`**, privado. As fotos são de clientes de clínica de
estética — URL pública ali significaria a foto de uma paciente acessível para
sempre, sem login. Por isso a leitura passa por `/api/painel/midia`, que assina
URLs de vida curta (10 min) com service_role.

**Caminho: `{slug-do-tenant}/{telefone}/{msgId}.{ext}`**, montado por
`caminhoMidia()` em `src/lib/storage.ts`.

A rota assina o que o cliente pedir — é uma lista de caminhos no corpo — e
service_role assina qualquer objeto do bucket. Sessão, portanto, não basta:
`dentroDoTenant()` exige que a **primeira pasta** seja o slug do tenant **da
sessão**, nunca um slug recebido do cliente.

⚠️ **Compara a pasta inteira, não `startsWith`.** Um prefixo solto aprovaria
`lins-antiga/…` para o tenant `lins` — dois slugs em que um começa com o outro
deixariam de estar separados. 24 asserts cobrindo isso, travessia de diretório
e arquivo na raiz do bucket.

Caminho fora do escopo é descartado **em silêncio**, sem 403: responder
"existe, mas não é sua" confirmaria a existência do arquivo para quem estivesse
adivinhando.

As policies do bucket repetem a mesma regra com `storage.foldername(name)[1]`.
Elas não são o que protege o dia a dia (service_role não passa por policy) —
existem para que ler o bucket com a sessão do usuário dê o mesmo resultado.

---

## Stack

Next.js 16 (App Router) + React 19 + TypeScript · **Tailwind v4** (config
CSS-first via `@theme`, não há `tailwind.config.ts`) · shadcn/ui · Supabase
(`@supabase/supabase-js` + `@supabase/ssr`) · Chart.js · TanStack Query ·
lucide-react. Deploy na Vercel.

**Route groups**: o root `layout.tsx` tem só `<html>/<body>`/fontes/`globals.css`.
O chrome do painel (AppShell + QueryProvider + ThemeProvider + Toaster) vive em
`src/app/(painel)/layout.tsx`. As rotas públicas ficam em `(publico)/` e **não
herdam nada do painel** — isolamento estrutural, não condicional. O site
institucional fica em `(site)/`.

**Cache**: TanStack Query por cima das queries (`src/lib/hooks.ts`), `staleTime`
30s, `refetchOnWindowFocus:false`, toast de erro global via `QueryCache.onError`.

---

## Regras visuais

O sistema é **superfície como OPACIDADE, não como cor**, sobre uma base escura.
São cinco camadas, e o valor à direita é como a alpha compõe **sobre a base**:

```
--mk-rebaixado    #181a1c     POÇO: lista que rola dentro da página
--mk-superficie   #00000040   card, painel, bolha          → #1d1f21
--mk-superficie-2 #00000026   popover, modal               → #212325
--mk-superficie-3 #00000014   menu sobre modal             → #242629
--mk-fundo        #27292c     o fundo da página  ← o TETO, não o piso
--mk-linha        #ffffff30   branco a 19%
```

As superfícies são **alpha** de propósito: é o que faz card sobre card e menu
sobre popover clarearem sozinhos, sem ninguém calcular tom novo a cada
combinação. O rebaixado e a base são **explícitos** porque alpha branco não
sabe escurecer.

⚠️ **A BASE NÃO É `#000000`, e isso é decisão de ago/2026.** Preto puro causa
halação — texto claro sangra na borda — e cansa em sessão longa, que é como
este painel é usado. Mas o motivo estrutural é outro: **sobre `#000000` não
existe degrau para baixo.** Só dá para clarear. Com modal sobre card sobre
lista não há como recuar uma camada, e a hierarquia colapsa numa coisa só.

⚠️ **Alpha não TAPA.** Popover, modal, dropdown, tooltip e cabeçalho fixo
precisam ocultar o que está atrás — em `--mk-superficie` o conteúdo de baixo
atravessa, e era exatamente o que acontecia antes. Para esses existem dois
tokens **opacos**, que não são cor nova: são a superfície-2 e a superfície-3
já compostas sobre a base.

```
--mk-elevado    #212325   popover, modal, dropdown, tooltip, cabeçalho fixo
--mk-elevado-2  #242629   menu que abre POR CIMA de modal
```

Se a base mudar, **recomponha os dois** — eles não acompanham sozinhos.

⚠️ **`rebaixado` é POÇO, não "moldura".** A sidebar já esteve nele e voltou
para a base em ago/2026: ela é superfície **irmã** do conteúdo, ao lado dele e
não abaixo, separada só pela hairline da direita. Poço é conteúdo que afunda —
lista que rola dentro de uma página. Hoje são três: a coluna das conversas, o
corpo das colunas do Kanban e o dia fora do mês no calendário.

**Onde cada camada entra:**

| camada | quem |
|---|---|
| `rebaixado` | coluna da lista de conversas, corpo da coluna do Kanban, dia fora do mês |
| `fundo` | `body`, `.content`, `.topbar`, **sidebar**, `bottom-nav`, área de mensagens do chat |
| `superficie` | card de KPI, painel de gráfico, bolha de mensagem, `.card` |
| `superficie-2` | realce sobre card (hover, trilho de barra, chip) |
| `superficie-3` | realce **dentro** de superfície elevada (item de menu em hover) |
| `elevado` | modal, `drp-pop`, menu de filtro, combo, tooltip, cabeçalho `sticky` |
| `elevado-2` | menu aberto **dentro** de modal |

⚠️ **A DIREÇÃO DA ESCADA INVERTEU EM AGO/2026, e é a mudança mais profunda
que o sistema já teve.** O card era mais CLARO que a página (1,07:1); agora é
mais **escuro** (1,13:1), como a referência, que trabalha em 1,19:1 nessa
direção. A subida de escala anterior tinha posto a página no valor que lá é do
CARD — consertar não era clarear mais, era virar a escada.

**As superfícies passaram a ser alpha PRETO**, e isso muda o raciocínio
inteiro: antes empilhar clareava, agora empilhar **escurece**.

⚠️ **ALPHA PRETO NÃO CLAREIA.** Um elemento que precise parecer um degrau
ACIMA de um card não consegue com estes tokens — composto sobre o card,
qualquer um dos três escurece. Já mordeu três lugares: `.sidebar-logo` (filha
da sidebar), `.rq-cfg-pergunta` (dentro de `.config-card`) e `.seg` (dentro do
cabeçalho de painel). Os três viraram `transparent`; quem separa ali é a borda.
Quem precisar mesmo de um degrau acima usa tom opaco.

⚠️ **E os 22 `:hover` que usam `--mk-superficie-2` sobre um card agora
ESCURECEM em vez de clarear.** Não são bug — um hover que afunda é leitura
legítima nesta direção —, mas o comentário original dizia "um degrau acima", e
não é mais isso que acontece.

⚠️ **A ESCALA JÁ TINHA SUBIDO ANTES, na mesma semana.** Sobre a base antiga
(`#0e0f11`, Y 0,0058) o card compunha Y 0,008 e a hairline Y 0,020 — contraste
borda/superfície de **1,21:1**, ou seja, a estrutura não separava nada. A
referência medida na tela trabalha em 1,72:1. A base subiu para `#1e1f21` e a
hairline de 10% para 19% de branco: o par foi para **1,70:1**. Matiz,
geometria e tipografia não mudaram.

Os dois opacos foram **recompostos** na mesma alteração — a regra "mudou a
base? recomponha os dois" existe exatamente para isso, e os valores saem da
conta, não do olho.

⚠️ **`--mk-tinta-fraca` ACOMPANHA A BASE, e já mudou três vezes por isso**
(`#62676d` → `#7d8288` → `#878c93`). Com a escada invertida ele dá **4,88 sobre
o card** — mas só **4,31 sobre a PÁGINA**, e ali reprova no AA. O card ficou
mais escuro e a página mais clara, então o mesmo token passa num lugar e falha
no outro. Onde ele dói é o texto solto sobre a página (`.env-intro`,
`.rq-cfg-explica`, `.kb-sub`, subtexto de vazio). `--mk-tinta` (12,44) e
`--mk-tinta-media` (5,59) sobram contraste nos dois planos.

A nota histórica original: **`#62676d` reprovava desde sempre.** O valor antigo
**reprovava no AA** e já reprovava antes desta troca — 3.68 sobre preto, 3.36
sobre a base nova, 3.17 sobre card. É o token do subtexto dos cards e dos
rótulos apagados, ou seja, texto pequeno, que é onde contraste baixo dói mais.
O novo dá **4.95** sobre a base e **4.67** sobre a superfície. Como
`--mk-st-arquivado` é apelido dele, o chip apagado passou a AA de brinde.

**Consequência que é regra, não gosto: ZERO `box-shadow` como SEPARAÇÃO.**
Sobre base escura com superfície translúcida a sombra não separa — mancha. A
separação é borda de 1px mais o degrau de camada. (O site institucional em
`(site)/` tem sistema próprio, claro e com sombra; ele não segue nada disto.)

⚠️ **Existe UMA `box-shadow` no painel, e ela não é sombra.** O Chrome pinta o
campo preenchido pelo autofill com um amarelo-claro próprio e **ignora
`background`** — sobre preto vira um campo branco no meio do formulário
escuro. Não há propriedade que sobrescreva aquilo; o único caminho é uma
sombra interna gorda o bastante para cobrir o campo:

```css
input:-webkit-autofill { box-shadow: 0 0 0 40px var(--mk-elevado) inset; }
```

É pintura, não elevação. Se aparecer uma segunda `box-shadow` no `globals.css`
que não seja esta, é regressão.

- **Densidade**: raiz em **16px**. Eram 13px no sistema claro — no escuro o
  texto miúdo some. Mora em `:root` porque `rem` resolve na raiz: **não há como
  escopar escala tipográfica por ancestral.**
- **Um raio só: 6px** (`--mk-raio`). Valores de 1–4px sobrevivem em ponta de
  barra e chip minúsculo, que são detalhe de sub-componente, não o raio do
  sistema.
- **Altura de controle 33px.** A raiz em 16px não mexe nisso: as alturas são
  em `px`. O que **inchou** 23% foi todo espaçamento em `rem` (`margin-bottom:
  2.5rem` virou 40px) e o `--radius` do shadcn (0.75rem → 12px, contra os 6px
  do sistema). Fica registrado, não corrigido — é varredura de arquivo
  inteiro, não desta alteração.
- **Escolha entre poucas opções é segmentado, não `<select>`.** O `<select>`
  nativo abre a lista com o widget do sistema operacional, que é **claro**, e
  não há CSS que mude. `src/components/segmentado.tsx` (`role="radiogroup"`,
  foco roving, setas) é o substituto; a regra é `.seg`/`.seg-opcao`.
- **Campo de texto é transparente com borda** — nunca cinza preenchido, que
  sobre a base lê como desabilitado. **Foco muda a cor da borda**, sem anel e
  sem brilho (`outline: none` + `border-color`).
- **Um botão primário sólido por tela.** Item de menu ativo muda **só de cor** —
  sem fundo, sem barra lateral.

### Tipografia

**Space Grotesk** em **título** · **IBM Plex Sans** no corpo **e no número** ·
**IBM Plex Mono** em dado tabular.

⚠️ **A Space Grotesk saiu do número do KPI em ago/2026.** Ela é fonte de
display — geométrica, feita para corpo grande —, e numa fileira densa de cinco
cards pesa mais que uma grotesca neutra no mesmo corpo. A Plex Sans já está no
projeto e tem algarismo **tabular por padrão** (todos os dígitos em 600/1000,
medido no `.woff2`), então não entrou família nova. Em título a Space Grotesk
fica.

**A escala do card é 20 / 11,5 / 10:**

```
valor      20px · peso 600 · Plex Sans · letter-spacing -0.01em · tabular-nums
rótulo     11.5px · peso 500
subtexto   10px · peso 400 · --mk-tinta-fraca
```

O defeito que isso corrigiu: o `root` foi de 13px para 16px, **o valor cresceu
junto e rótulo e subtexto ficaram para trás**. Em 26px o valor tinha 2,6× o
subtexto; a proporção da referência é 2×.

A caixa útil do valor é **181px** (239 do card, menos 32 de padding, menos 16
do ícone e 10 do gap). Medido no `.woff2` que o `next/font` baixa,
`R$ 12.078,17` dá **276px** em Space Grotesk 700 a 44,5px (não cabia), **161px**
a 26px e **124px** em Plex Sans 600 a 20px.

O 48px fica **guardado** para quando existir um card herói de verdade, sozinho
na largura.

**A altura do card é consequência, não causa.** A anatomia é `padding 13/16 ·
gap 12` e **três linhas, cada uma com começo e fim**: rótulo (+ `ⓘ`), valor, e
subtexto + ícone na MESMA linha. O ícone fechando a última linha é o que faz o
card parecer resolvido — na linha do valor ele ficava pendurado fora do fluxo.

As três alturas de linha são **explícitas** (1,1 / 1,05 / 1,1) porque a padrão
do documento (1,5) sozinha jogaria o card para 101px. Não se ajusta altura
comprimindo padding — 13/16 fica, senão o card aperta quando o número real
entrar.

⚠️ **O alvo de 94px não fecha com ícone na última linha, e a conta prova:**

```
Negócios         26 padding + 12,65 + 12 + 21 + 12 + 16 (o ícone manda) = 99,65
Multiatendimento 26 padding + 12,65 + 12 + 21 + 12 + 11 (sem ícone)     = 94,65
```

Com padding 13 e gap 12 sobram **44px** para as três linhas, e rótulo + valor +
ícone em `line-height: 1` já pedem 47,5. Os quatro números da referência (94 de
altura, 13 de padding, 12 de gap, 16 de ícone) são **sobredeterminados** — não
existe combinação que satisfaça os quatro. Ficaram os três visíveis; a altura é
o que sobra. `min-height: 94px` continua declarado como piso, mas não chega a
valer.

⚠️ **A SELEÇÃO DO CARD USA A COR DO PRÓPRIO CARD**, e é isso que a torna
navegação em vez de enfeite: a borda de 1px e a **linha protagonista do
gráfico** saem do mesmo token. **UM traço só** — já teve borda *e* faixa de 2px
no topo, e os dois marcavam a mesma coisa duas vezes, deixando a aresta
superior pesada e fora de alinhamento com os cards vizinhos.

```
Total criado        --mk-acento          roxo
Total ganhos        --mk-st-resolvido    verde
Total perdidos      --mk-st-erro         vermelho
Total em aberto     --mk-st-agendado     azul
Receita recuperada  --mk-st-atendendo    teal
```

A tabela mora em **`TOKEN_DO_TOM`** (`kpi-card.tsx`) e é o NOME do token, nunca
o hex — o canvas do gráfico não herda CSS, então a cor é lida com
`getComputedStyle`. Uma tabela só impede que card e gráfico divirjam.

Antes a borda era sempre `--mk-acento`: clicar em qualquer um dos cinco dava a
mesma borda roxa, e a cor do card só existia num ícone de 16px. Nunca fundo
colorido — a cor entra em traço, não em massa.

⚠️ **O gráfico de linha tem calha de eixo Y, e ela não sai de novo.** Já saiu
uma vez, para liberar ~60px de largura, com o valor do pico flutuando junto do
ponto máximo no lugar dela. O que se perdeu foi a **referência de escala**: sem
eixo a linha mostra a forma e esconde a grandeza, e o gráfico vira desenho. Os
rótulos de ponta que entraram como compensação ainda disputavam espaço com a
própria linha quando duas séries terminavam perto.

Voltou em ago/2026: rótulos à esquerda em **IBM Plex Mono 10px**
(`--mk-tinta-fraca`), grade horizontal em `--mk-linha-suave`, `maxTicksLimit: 4`,
e o zero desenhado à mão em `--mk-linha` — ele é referência, não mais uma
divisão. Mono aqui **não** contradiz "frase é sans": rótulo de eixo é coluna de
números que precisa alinhar. Junto voltaram a sair o pico flutuante e o valor
no rótulo de ponta, que existiam só porque não havia eixo — com ele, os dois
viravam a terceira grafia do mesmo número.

⚠️ **`ⓘ` não é para todo card.** Ajuda em tudo é ajuda em nada: com os cinco
marcados, o ícone virava parte do desenho. Ficam **"Total em aberto"** e
**"Receita recuperada"**, que não se explicam pelo rótulo. Consequência aceita:
a ressalva de preço (atendimentos sem serviço no catálogo, fora da soma) viajava
em todas as dicas e agora só aparece nessas duas.

⚠️ **Mono é para dado tabular; frase é sans.** Vale para valor de eixo, tabela
numérica, horário e código. Subtexto de card, label e descrição vão em IBM
Plex Sans — `0 marcações feitas` em monoespaçada tem cara de log de terminal.
`.neg-card-apoio` já esteve na lista errada.

⚠️ **`.neg-fill` NÃO é um elemento de valor** — é o wrapper da aba Negócios
inteira. Pôr `font-family` nele joga a aba toda em monoespaçada. Já aconteceu.

### Cor

```
--mk-acento    #a78bfa   violeta; ação e estado ativo. UM só.
--mk-ativa     #3fb950   está funcionando
--mk-pausada   #7dd3fc   está parado
--mk-alerta    #f85149   erro e perda
--mk-aviso     #d9a441   precisa de atenção, mas não é erro
--mk-serie-1..5          categoria em gráfico
--mk-pessoa-1..6         avatar sem foto
```

**Cor semântica nunca é decoração, e categoria nunca usa cor semântica.** Foi
assim que a rosca de serviços virou arco-íris no painel antigo.

#### Estado

⚠️ **"Um acento só" vale para DECORAÇÃO, não para estado.** Levar a regra ao pé
da letra foi o que deixou a tela em preto + roxo + cinza, com o violeta fazendo
três trabalhos ao mesmo tempo. Quando a cor carrega informação que o olho
precisa distinguir sem ler, ela é **dado**.

```
--mk-st-aguardando   = --mk-aviso        chegou e ninguém pegou
--mk-st-atendendo    #16a7a3             humano dentro da conversa
--mk-st-ia           = --mk-acento       a IA está conduzindo
--mk-st-agendado     = --mk-pausada      tem horário marcado
--mk-st-resolvido    = --mk-ativa        fechou bem
--mk-st-erro         = --mk-alerta       falhou, precisa de gente
--mk-st-arquivado    = --mk-tinta-fraca  saiu da fila
```

**Seis dos sete são apelido, não cor nova.** O sistema já tinha as cores; o que
faltava era o nome do estado. Declarar um segundo hex para "verde de sucesso"
seria dois vocabulários para a mesma coisa — o defeito que o renome de ago/2026
tirou do arquivo. `--mk-st-atendendo` é o único hex novo, e só existe porque
nenhuma cor do sistema significava aquilo.

Cada estado entra em **duas** formas, nunca em bloco chapado:

```css
color: var(--mk-st-x);                                   /* ícone e texto */
background: color-mix(in srgb, var(--mk-st-x) 12%, transparent);
border-color: color-mix(in srgb, var(--mk-st-x) 35%, transparent);
```

Proibido: estado como fundo cheio, estado em elemento que não representa aquele
estado, e cor de marca representando estado — com a exceção de `ia`, que **é** a
marca porque a IA é o produto.

⚠️ **Dois hexes do desenho original não sobreviveram à medição**, e os dois
seriam chips vizinhos na mesma barra: `#58a6ff` para `agendado` fica a **dE
0.107** do acento (o mesmo motivo pelo qual `--mk-pausada` deixou de ser aquele
azul), e `#e0b341` para `atendendo` fica a **dE 0.080** do laranja de
`aguardando` — menos da metade do piso do sistema. Rosa também não serve: todo
rosa legível fica a ~0.065 de `--mk-serie-4`.

**O piso é 0.184** — o par `--mk-alerta`/`--mk-aviso`, que já está em produção.
Na barra de conversas o menor par ficou em **0.182**. E há teto de quantos
matizes cabem: um oitavo estado não passa de 0.166 contra algum dos sete.

O acento vive em **quatro linhas** de `globals.css`. Trocar a identidade depois
é mexer só nelas. O dourado `#8a6a2f` da LINS não sobreviveria a esta troca de
qualquer forma: dá 4.18 sobre preto e reprova no AA de texto pequeno.

⚠️ **`--mk-pausada` não é o `#58a6ff` da referência.** Aquele azul ficava a
**dE 0.107** do acento violeta — metade da separação de qualquer outro par do
sistema, e abaixo do degrau `tinta-media`↔`tinta-fraca` (0.194), que já é a
distinção mais sutil da paleta. Duas cores com **significados diferentes** não
podem ficar mais próximas que dois cinzas que só diferem em ênfase.

**A rampa de série foi escolhida em OKLab, não por contraste WCAG.** Contraste
mede legibilidade de *texto*; dois setores vizinhos de uma rosca podem ter a
mesma luminância e serem obviamente distintos. A primeira tentativa (rampa de
um matiz só) dava 1.38 de contraste entre dois passos — invisível. A que ficou
tem pior par em dE 0.135 e vizinhos em 0.168, e **a ordem faz parte da
definição**.

⚠️ **Três lugares montam o nome do token por string**, e busca por `bg-mk-` não
os pega: `dashboard/service-chart.tsx` (`` `--mk-serie-${i}` ``),
`lib/format.ts` (array `--mk-pessoa-1..6`) e `lib/atribuicao.ts` (array
`--mk-serie-1..5`). O renome de ago/2026 passou batido no primeiro deles e a
rosca ficou sem cor até o verificador de tokens apontar.

### Nada de hex literal fora do bloco de tokens

As exceções são todas nomeadas e têm razão: `--mk-papel` (branco funcional — o
leitor de QR do WhatsApp precisa de fundo claro) e a lista `CORES` de
`profissional-modal.tsx` (identidade gravada em `profissionais.cor`, então é
dado, não estilo).

### Aparência é uma só

O `<html>` ainda carrega `data-mode` e `data-theme`, mas o catálogo
(`src/lib/tema.ts`) tem **uma** entrada. Não é preguiça: o sistema não tem
versão clara — branco a 3% *sobre branco* não é superfície, é nada. A estrutura
fica de pé para o dia em que houver um segundo sistema.

**CSS semântico é o padrão da casa**: as regras moram em `globals.css`
(`.neg-card`, `.nav-item`, `.mtz-*`). Tailwind só em layout pontual.
**Se nomear uma classe, escreva o CSS dela na mesma alteração.**

## Desativar e excluir

O padrão vale para as telas que criam alguma coisa — profissionais, requisitos,
promoções:

```
DESATIVAR   sempre disponível · reversível · preserva histórico
EXCLUIR     só quando não há filho · confirmação NOMEANDO o item · irreversível
```

⚠️ **O BANCO NÃO PROTEGE NADA DISSO — medido em transação com ROLLBACK.**
Apagar uma profissional COM agendamento **passa sem erro**: a FK é
`ON DELETE SET NULL`, o agendamento fica com `profissional_id` nulo e o
histórico perde quem atendeu, em silêncio. Apagar um requisito COM resposta
também **passa sem erro**: as FKs de `requisito_campos`,
`requisito_procedimentos` e `requisito_respostas` são `ON DELETE CASCADE`, e as
respostas somem junto. A trava é a interface, e só ela.

⚠️ **Quando excluir não for possível, o botão NÃO some em silêncio** — o motivo
aparece escrito no lugar dele. Botão que desaparece sem explicação faz a pessoa
procurar, desistir e achar que o sistema é quebrado.

⚠️ **Item desativado nunca some da tela**: vai para um bloco recolhido no fim
(`.arq-*`), com contador e opção de reativar. Sumir faz a pessoa achar que
apagou — e aí ela cria outro igual.

⚠️ **Confirmação é `<Confirmar>` (`src/components/confirmar.tsx`), nunca
`window.confirm`.** O diálogo nativo é desenhado pelo sistema operacional, que
é **claro** — no painel escuro ele vira uma caixa branca sem relação com o
resto. Mesmo motivo pelo qual o `<select>` saiu da Visão geral. E ele **nomeia
o item**: "Excluir a profissional Rozaria?", nunca "Tem certeza?" — diálogo
genérico é clicado no automático.

**Ação destrutiva usa `--mk-st-erro` só no TEXTO**, nunca como fundo cheio de
botão: bloco de cor puxa o clique justamente onde não se quer pressa.

## Defeitos conhecidos (herdados, não são regressão)

- **Teto de 1.000 linhas do PostgREST.** Ele devolve no máximo 1.000 linhas e
  **não sinaliza quando corta**: sem erro, sem status diferente.
  `select()` sem `.limit()` não traz "tudo" — traz "até mil, e cala". Já quebrou
  em produção no painel antigo. Ao escrever query, pergunte *"e se passar de
  mil?"*. Ordenação **crescente** é o caso perigoso (descarta o recente/futuro).
  `src/lib/paginar.ts` (`buscarTodasAsPaginas`) resolve por `.range()`, e
  **paginar exige ordenação determinística** — sem desempate por `id` o Postgres
  pode devolver ordem diferente a cada página, duplicando umas linhas e perdendo
  outras.
  Ainda sem teto: `getAgendamentosByLead` e `getAgendaSlots` em `queries.ts`,
  mais `agente/route.ts` (a contagem de leads pausados), `ficha-db.ts`,
  `promocao-db.ts`, `bloqueios.tsx`, `secao-profissionais.tsx`. Lista com
  linha em `INVENTARIO.md` §5.
- ~~Classe CSS nomeada sem regra~~ — **resolvido em ago/2026.** Eram três, não
  duas: `.metrics-lente`, `.nav-item-footer` e `.drp-mes` (o CSS tinha
  `.drp-meses` e `.drp-mes-nome`, e a do meio faltava). Classe sem regra não
  quebra build nem teste — o elemento só renderiza sem estilo, e um player de
  áudio já foi para produção assim. A conferência deixou de ser manual: o
  `npm run verificar:css` cruza toda classe da casa usada no markup contra as
  regras do CSS e falha se sobrar alguma. Nome montado por string
  (`` `neg-tom-${tom}` ``) ele **não** pega — esses três lugares estão listados
  na seção de cor. Há uma exceção tolerada e documentada no próprio script:
  `.ag-lista-dia`, que é o containing block de um cabeçalho `sticky` e precisa
  continuar sendo bloco simples.
- ⚠️ **A ficha de avaliação antiga é código morto.** `fichas_avaliacao` **não
  existe neste banco**, e tudo que fala com ela continua no repositório:
  `src/lib/ficha-db.ts`, `src/lib/ficha.ts`, `src/components/ficha/*`,
  `/api/ficha/[token]` e `/api/painel/ficha*`. A rota `/ficha/[token]` era dela
  e passou a servir o formulário de REQUISITOS em ago/2026 — não havia link em
  circulação apontando para cá (a LINS segue no painel antigo, em outro
  domínio). Os arquivos ficam esperando a limpeza do A3.
- ⚠️ **`requisito_campos` não tem coluna `ativo`.** Então "desativar o campo e
  criar um novo" — o caminho seguro quando a `chave` precisa mudar — ainda não
  existe pelo painel: só dá para apagar. Trocar a chave QUEBRA O HISTÓRICO (as
  respostas antigas guardam a chave velha no `jsonb`), e por isso a tela conta
  quantas respostas já a usam e pede confirmação antes.
- ⚠️ **`ConversaOrigem` não bate com o banco.** `src/types/db.ts` declara
  `"cliente" | "agente" | "humano"`; o CHECK de `conversas.origem` é
  `cliente | ia | humano | sistema`. `getLastMsgPreview` compara com
  `"agente"` — que nunca vai casar, então a prévia da lista sairá sem o
  prefixo 🤖 e `bubbleClasses("agente")` pinta a bolha errada. Não quebra: só
  mente em silêncio. É item de A3 (as telas que ainda falam o schema antigo),
  não regressão.
- ~~`agendamentos.status = 'faltou'` sem badge~~ — **resolvido em ago/2026.**
  Estava no CHECK do banco desde sempre e faltava no mapa de
  `statusBadgeClass` e no tipo `AgendamentoStatus`: caía no fallback e um
  não-comparecimento saía com a cara de "novo".
- **Kanban**: `Faltou` e `Cancelado` são colunas **diferentes** e isso não é
  negociável — quem avisa dá chance de revender o horário, quem não aparece
  leva a receita junto. Juntar as duas apaga a taxa de no-show, que é o número
  do cabeçalho. E `kanban_mover` **não bloqueia transição nenhuma** de
  propósito: ela avisa (`REALIZADO_ANTES_DA_HORA`) e move. Kanban rígido é como
  se volta a anotar no caderno.
- ⚠️ **`promocoes.valor_promocional` é `numeric`, e a tela assume texto livre.**
  O PostgREST entrega numeric como **número**, não string. `montarPromocoes`
  declarava `string | null` e fazia `?? ""` — que não pega número — e caía em
  `valoresDoTexto`, ou seja, `.matchAll` num number:
  `TypeError: texto.matchAll is not a function`, **500 em `/api/painel/servicos`**
  assim que existiu UMA promoção ativa. Corrigido em set/2026 (`precoDaPromocao`
  em `servicos.ts`, `lerPromocao` em `promocao.ts` para os quatro pontos de
  leitura de `promocao-db.ts`, que faziam `as Promocao` sobre um cast que
  mentia). ⚠️ **O que NÃO foi corrigido é a incompatibilidade de fundo**: o
  formulário pede "Informe o valor como o cliente ouve" e valida como texto
  falado, mas a coluna é numérica. Medido com `pg_input_is_valid`: ela aceita
  `"499.90"` e **recusa com `22P02`** `"R$ 499,90"`, `"25% de desconto no Pix"`
  e até `"499,90"` — a vírgula que qualquer brasileira digitaria. Resolver isso
  é decidir de que lado fica a verdade (coluna vira `text`, ou o campo vira
  numérico com máscara) e leva migration.
- ⚠️ **Conta sem vínculo vê o painel INTEIRO zerado, e isso mente.** Sem linha
  em `usuarios_tenant`, `minhas_clinicas()` devolve zero, as leituras por RLS
  devolvem **zero linhas sem erro** e a Visão geral renderiza `R$ 0,00` nos
  cinco KPIs com "Nenhum atendimento realizado no período" — indistinguível de
  uma clínica parada. Só as rotas que passam por `resolverTenant` acusam, com
  403 `sem_clinica`; e `hooks.ts` descarta a frase do servidor ("Esta conta
  ainda não está vinculada a nenhuma clínica") em favor do toast genérico
  "Erro ao carregar os dados." O aviso na sidebar existe, mas compete com o
  corpo da tela dizendo o contrário. É o primeiro lugar a olhar quando "a tela
  não carrega" e todos os números estão em zero.
- **`/privacidade`**: a constante `CONTATO` está vazia. Não divulgar o link
  antes de preencher.
- **Migrations do painel antigo em `supabase/migrations/_legado/`**: cinco
  arquivos sem uma menção a `tenant_id`. Ficam numa subpasta porque
  `supabase db push` varre só o nível de cima — rodá-las instalaria
  `agenda_slots`/`agenda_checar` sem filtro de clínica e um trigger de
  validação alheio ao tenant. Ver o `LEIA-ME.md` de lá antes de aproveitar
  qualquer coisa.

## Fora deste repositório

O agente, os fluxos e as tools vivem no **n8n** (nuvem). Este front só lê e
escreve no Supabase. Mudança de prompt ou de fluxo do agente se faz lá.

## Princípios

- Português do Brasil em toda a UI.
- ⚠️ **A INSTÂNCIA DA EVOLUTION VEM DO SLUG**, nunca de `EVOLUTION_INSTANCE`
  nem de escolha da clínica: `instanciaDoSlug()` em `src/lib/evolution.ts`. Com
  a variável de ambiente o painel inteiro falava por UMA instância, e a segunda
  clínica mandaria mensagem pelo WhatsApp da primeira. Se a clínica escolhesse
  o nome, duas escolheriam o mesmo e uma sobrescreveria a outra.
- ⚠️ **Instância já existente NÃO é erro.** A Evolution devolve 403/409 quando
  o nome está em uso, e aqui isso significa "esta clínica já conectou antes" —
  o caminho normal de reconexão.
- ⚠️ **Responder pelo painel GRAVA ANTES DE ENVIAR.** `painel_responder` acha
  telefone e instância, pausa a agente e registra a conversa numa transação; só
  então a rota chama a Evolution. Se o envio falhar, a mensagem está no
  histórico e a tela diz que não saiu — antes era o contrário, e a mensagem
  sumia sem rastro.
- ⚠️ **Realtime NÃO está habilitado**: a publicação `supabase_realtime` não tem
  nenhuma tabela (conferido em set/2026). A assinatura em `conversas.tsx` fica
  inerte, e quem atualiza é um poll de 5s — só com conversa aberta. Ligar
  `conversas` e `leads` na publicação aposenta o poll.
- ⚠️ **O nome da agente vem do BANCO, nunca do código.** Ele mora em
  `tenant_config.agente_nome` (`Sofia` para a LINS) e chega às telas pelo
  `useTenant()`, junto com `minhas_clinicas()`. O painel inteiro já disse
  o nome da agente da clínica ANTIGA em 112 lugares, e trocar a string por
  outra teria só adiado o problema: uma odonto vai querer um terceiro nome.
  O fallback é **"a agente"**, genérico de propósito, porque nome errado é pior
  que nome nenhum. A única exceção é o site institucional, que é público e não
  tem tenant para consultar: lá o nome está em `AGENTE_VITRINE`
  (`src/lib/site.ts`), num lugar só.
- Componentes pequenos. Nada de arquivos gigantes.
- Não alterar schema sem necessidade; se precisar, gerar migration em
  `supabase/migrations/` e registrar aqui.

## Como manter este arquivo

Ao concluir um bloco de trabalho ou tomar uma decisão de arquitetura, atualize
este arquivo. Ele é a memória do projeto e toda sessão futura age como se fosse
verdade — **informação errada aqui custa mais que informação faltando.** Na
dúvida entre descrever algo incerto e omitir, omita.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
