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
   vazio, combinador solto e chave desbalanceada — os defeitos que uma edição
   por script deixa para trás. Rode depois de qualquer alteração em massa no
   `globals.css`.

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

O sistema é **superfície como OPACIDADE, não como cor**, sobre preto real.
Cabe em três linhas:

```
fundo       #000000     preto real, não cinza-escuro
superfície  #ffffff08   branco a 3% SOBRE o preto
borda       #ffffff1a   branco a 10%
```

Funciona porque o fundo é preto **de verdade**: 3% de branco parece iluminado
por dentro, não pintado por cima. E sendo opacidade em vez de cor fixa, tudo
empilha coerente — card sobre card, popover sobre card — sem ninguém calcular
tom novo a cada camada.

**Consequência que é regra, não gosto: ZERO `box-shadow` como SEPARAÇÃO.**
Sobre preto com superfície translúcida a sombra não separa — mancha. A
separação é 100% borda de 1px. (O site institucional em `(site)/` tem sistema
próprio, claro e com sombra; ele não segue nada disto.)

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
- **Altura de controle 33px.**
- **Campo de texto é transparente com borda** — nunca cinza preenchido, que
  sobre preto lê como desabilitado. **Foco muda a cor da borda**, sem anel e
  sem brilho (`outline: none` + `border-color`).
- **Um botão primário sólido por tela.** Item de menu ativo muda **só de cor** —
  sem fundo, sem barra lateral.

### Tipografia

**Space Grotesk** em número e título · **IBM Plex Sans** no corpo · **IBM Plex
Mono** em dado tabular. A Space Grotesk tem dígito de largura constante — o
Cormorant, que estava ali antes, tem largura variável e fazia o valor dançar de
um card para o outro.

Número grande: **48px / 700**, com `clamp` — cinco cards lado a lado estouram
a caixa em tela estreita, e valor quebrado em duas linhas é pior que valor
menor.

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
- ~~Classe CSS nomeada sem regra~~ — **resolvido em ago/2026.** Eram três, não
  duas: `.metrics-lente`, `.nav-item-footer` e `.drp-mes` (o CSS tinha
  `.drp-meses` e `.drp-mes-nome`, e a do meio faltava). Classe sem regra não
  quebra build nem teste — o elemento só renderiza sem estilo, e um player de
  áudio já foi para produção assim. Por isso a conferência virou mecânica:
  **ao terminar qualquer alteração de CSS, confira que toda classe nomeada tem
  regra.**
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
