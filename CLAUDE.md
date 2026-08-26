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

**20 tabelas, todas com RLS ligada.** 19 têm `tenant_id uuid NOT NULL`; a
exceção é `prompt_base`, que é global (o prompt-base do agente, igual para
todas as clínicas, leitura liberada a `authenticated`).

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

**Agenda e catálogo** — `profissionais` · `profissional_horarios` (padrão
semanal) · `profissional_excecoes` (exceção por data) · `profissional_bloqueios`
· `procedimentos` (com `duracao_min` e `preco`) · `procedimento_apelidos`
(sinônimos: "virilha" acha depilação) · `profissional_procedimentos` (linha
ausente = a profissional **não** faz aquele procedimento).

**Não existe nenhuma view.** E não existe bucket de storage ainda —
`midia-conversas` é criado pela migration `20260825_bucket_midia_conversas.sql`.

### Quem pode chamar o quê

```
authenticated (painel, via anon key + RLS)
  minhas_clinicas()          clínicas desta conta (tenant_id, slug, nome, papel)
  tenant_valido(uuid)        valida um tenant contra a sessão → devolve o uuid
  painel_agenda(...)         agenda; o tenant vem da sessão
  meus_tenants()             usada dentro das policies

service_role (só n8n e route handler)
  agenda_consultar / agenda_marcar / agenda_alterar
  montar_prompt / tenant_por_canal / procedimento_resolver / agenda_escala
```

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

**`tenant_valido(p_tenant)`**:
- `null` → devolve o tenant da conta (para quem só tem um);
- um uuid → confere em `usuarios_tenant` contra `auth.uid()` e **levanta
  exceção** (`acesso negado a esta clinica`) se não bater.

---

## ⚠️ O código ainda não conhece este banco

O clone veio do painel single-tenant. Leia `INVENTARIO.md` antes de mexer em
qualquer query — o levantamento completo está lá. O resumo do que **não existe**
neste banco e o código continua chamando:

| O código chama | Situação |
|---|---|
| `agenda_slots`, `agenda_checar`, `agenda_profissionais_na_escala` | **não existem** — o equivalente é `painel_agenda` |
| `documentos_lins` | virou `documentos` |
| `conversa_ultima_por_lead` (view do inbox) | **não existe** |
| `follow_ups_resultado` (view) | **não existe** — existe a tabela `follow_ups` |

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
| `promocoes.valor_promocional` / `.condicao` / `.dia_semana` | `preco`, `valida_de`, `valida_ate`, `ativa` |

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
- **Seletor de clínica** (`src/components/tenant-provider.tsx`): carrega
  `minhas_clinicas()` uma vez. Uma clínica → sem seletor visível, tenant
  implícito. Mais de uma → seletor no topo da sidebar, escolha persistida em
  `localStorage`. O valor persistido **nunca** é fonte de verdade sozinho: vai
  como parâmetro e o banco valida.

⚠️ **Armadilha de build**: `useSearchParams()` exige `<Suspense>`. O build
*compila* e só o **export** quebra — grepar `✓ Compiled` esconde a falha.
**Sempre cheque o exit code do `npm run build`.**

---

## Ambiente

```
NEXT_PUBLIC_SUPABASE_URL=https://hcexbbmgfekpaakerfys.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # sem NEXT_PUBLIC_, jamais
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=
```

São essas seis, e só essas. As três da Evolution **não** levam `NEXT_PUBLIC_`:
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

**Caminho: `{slug-do-tenant}/{telefone}/{msgId}.jpg`.** A rota que assina valida
que todo caminho começa com o slug do tenant **da sessão** — nunca com um slug
recebido do cliente. Sem essa trava, uma conta de uma clínica assinaria a mídia
de outra.

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

O sistema é **superfície única com separação por hairline de 1px**. Vale como
está:

- **Densidade**: `:root:has(.layout) { font-size: 13px }` — a escala rem do
  painel encolhe 0.8125×. Fica preso ao chrome do CRM **de propósito**: `rem`
  resolve na raiz, então pôr isso em `html` encolheria junto a ficha da paciente
  (formulário de saúde no celular) e a landing.
- **Zero `box-shadow` no plano da página.** Card, painel e linha de tabela se
  separam por borda, nunca por sombra. Sombra existe só em camada **flutuante**
  — modal, dropdown, tooltip, popover — e sempre pelos tokens `--mk-shadow-*`.
- **Altura de controle 33px.** Raio **5px** em controle (`--mk-radius-sm`),
  **8px** em container (`--mk-radius`).
- **Campo de texto é branco com borda** — nunca cinza preenchido. **Foco muda a
  cor da borda**, sem anel e sem brilho (`outline: none` + `border-color`).

**CSS semântico é o padrão da casa**: as regras moram em `globals.css`
(`.neg-card`, `.nav-item`, `.mtz-*`). Tailwind só em layout pontual.
**Se nomear uma classe, escreva o CSS dela na mesma alteração.**

**Tokens `--mk-*`** (eram `--vx-*`; renomeados em ago/2026). Expostos como
utilitários Tailwind (`bg-mk-surface`, `text-mk-accent`) pelo bloco
`@theme inline` no topo de `globals.css`.

⚠️ **Três lugares montam o nome do token por string**, e um replace ingênuo de
`bg-mk-` não os pega: `dashboard/service-chart.tsx` (`` `--mk-cat-${i}` ``),
`lib/format.ts` (array `--mk-av-1..6`) e `lib/atribuicao.ts` (array
`--mk-cat-1..5`).

### Modo e paleta são coisas SEPARADAS

O `<html>` carrega **dois** atributos: **`data-mode="light|dark"`** (o
estrutural — contraste, sombras, e o variant `dark:` do Tailwind) e
**`data-theme="<id>"`** (a paleta). Um tema novo **só declara tokens `--mk-*`**;
não escreve regra de CSS nova. Catálogo em `src/lib/tema.ts` (`TEMAS`,
`ehTema`, `modoDoTema`) — fonte única: o `ThemeScript` gera dele o mapa id→modo
do script anti-flash, e Configurações → Aparência renderiza a partir dele.

**A cor de acento (`--mk-accent`, dourado `#8a6a2f`) era a marca da LINS.**
O Meraki é plataforma, não clínica de estética. A identidade ainda **não foi
decidida** — o dourado fica, isolado no token, para trocar num lugar só quando
for a hora. Não espalhe hex de acento pelo CSS.

---

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
  mais `laura/route.ts` (a contagem de leads pausados), `ficha-db.ts`,
  `promocao-db.ts`, `bloqueios.tsx`, `secao-profissionais.tsx`. Lista com
  linha em `INVENTARIO.md` §5.
- **Classe CSS nomeada sem regra correspondente**: `.metrics-lente`
  (`dashboard/metrics-grid.tsx`) e `.nav-item-footer` (`app-shell.tsx`) são
  usadas no `className` e não têm regra em lugar nenhum. Renderizam sem estilo
  próprio. É a razão da regra "se nomear uma classe, escreva o CSS dela".
- **`/privacidade`**: a constante `CONTATO` está vazia. Não divulgar o link
  antes de preencher.

## Fora deste repositório

O agente, os fluxos e as tools vivem no **n8n** (nuvem). Este front só lê e
escreve no Supabase. Mudança de prompt ou de fluxo do agente se faz lá.

## Princípios

- Português do Brasil em toda a UI.
- Componentes pequenos. Nada de arquivos gigantes.
- Não alterar schema sem necessidade; se precisar, gerar migration em
  `supabase/migrations/` e registrar aqui.

## Como manter este arquivo

Ao concluir um bloco de trabalho ou tomar uma decisão de arquitetura, atualize
este arquivo. Ele é a memória do projeto e toda sessão futura age como se fosse
verdade — **informação errada aqui custa mais que informação faltando.** Na
dúvida entre descrever algo incerto e omitir, omita.
