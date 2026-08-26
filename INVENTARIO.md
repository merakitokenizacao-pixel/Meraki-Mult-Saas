# INVENTÁRIO — o que existe hoje neste clone

Levantado em 25/08/2026, direto do código e do banco novo
(`hcexbbmgfekpaakerfys`), antes de qualquer edição. É o mapa dos blocos
seguintes; onde a descrição de partida divergiu do que o código faz, o que vale
é o que está aqui.

---

## 1. Arquivos que falam com o Supabase

**Três clientes**, e é a distinção mais importante do repositório:

| Arquivo | Chave | RLS | Quem pode importar |
|---|---|---|---|
| `src/lib/supabase.ts` | anon | **respeita** | navegador (`createBrowserClient`, sessão em cookie) |
| `src/lib/supabase-server.ts` | anon | **respeita** | servidor (`createServerClient` + cookies) |
| `src/lib/supabase-admin.ts` | **service_role** | **IGNORA** | só servidor (`import "server-only"`) |
| `src/middleware.ts` | anon | — | só valida sessão (`getUser()`) |

> ⚠️ **`supabase-server.ts` não é importado por ninguém.** Todo caminho de
> servidor deste repositório usa `service_role`. Ou seja: hoje **nenhuma**
> leitura server-side passa por RLS. Isso é o coração do Bloco 4.

**Consumidores de `service_role` (11 módulos):**

| Arquivo | O que toca |
|---|---|
| `src/app/api/painel/enviar-mensagem/route.ts:61` | `insert` em `conversas` |
| `src/app/api/painel/laura/route.ts:18` | `conversas`, `leads` (agregados) |
| `src/app/api/painel/leads-ativos/route.ts:26` | `conversas` |
| `src/app/api/painel/midia/route.ts:53` | Storage — assina URLs |
| `src/app/api/site/agenda-demo/route.ts:65` | **rota pública** — `agenda_slots`, `procedimentos` |
| `src/lib/ficha-db.ts` (6×) | `fichas_avaliacao`, `leads`, `agendamentos` |
| `src/lib/followup-db.ts:11` | `follow_ups_resultado` |
| `src/lib/promocao-db.ts` (6×) | `promocoes` |
| `src/lib/servicos-db.ts` (2×) | `documentos_lins`, `promocoes` |

**Leitura direta do navegador (anon + RLS)** — `queries.ts`, `bloqueios.ts`,
`escala.ts`, `matriz-procedimentos.ts`, `slot-agenda.ts`, `agenda.tsx`,
`new-lead-modal.tsx`, `configuracoes/*`.

---

## 2. Tabelas e funções referenciadas × o que existe no banco novo

### Tabelas

| Referência no código | Onde | Banco novo |
|---|---|---|
| `agendamentos` | `queries.ts:133,155,169,183,192,199,207`, `ficha-db.ts:110`, `profissional-modal.tsx:97` | ✅ |
| `conversas` | `queries.ts:254`, `enviar-mensagem/route.ts:62`, `laura/route.ts:23,30`, `leads-ativos/route.ts:31` | ✅ |
| `leads` | `queries.ts:22,35,45`, `ficha-db.ts:97`, `laura/route.ts:37,40,42`, `new-lead-modal.tsx:157` | ✅ |
| `procedimentos` | `matriz-procedimentos.ts:55,116,126,143`, `agenda-demo/route.ts:76` | ✅ |
| `profissionais` | `queries.ts:286`, `agenda.tsx:35`, `matriz-procedimentos.ts:60`, `profissional-modal.tsx:64,67,118`, `secao-profissionais.tsx:21,55` | ✅ |
| `profissional_bloqueios` | `bloqueios.ts:33,48,54`, `bloqueios.tsx:22,80,100` | ✅ |
| `profissional_horarios` | `queries.ts:288`, `editor-escala.tsx:86,92`, `secao-profissionais.tsx:23` | ✅ |
| `profissional_procedimentos` | `matriz-procedimentos.ts:65,89,106` | ✅ |
| `promocoes` | `promocao-db.ts:20,31,46,56,73,88`, `servicos-db.ts:37` | ✅ |
| `fichas_avaliacao` | `ficha-db.ts:25,51,78,133,143` | ✅ (colunas mudaram — ver §2.1) |
| `documentos_lins` | `servicos-db.ts:23` | ❌ **não existe** — agora é `documentos` |
| `conversa_ultima_por_lead` (view) | `queries.ts:226` | ❌ **não existe** (o banco novo não tem view nenhuma) |
| `follow_ups_resultado` (view) | `followup-db.ts:19` | ❌ **não existe** (existe a tabela `follow_ups`) |

Tabelas do banco novo que **nenhum código deste repo conhece**: `tenants`,
`tenant_config`, `usuarios_tenant`, `canais`, `prompt_base`,
`tenant_blocos_prompt`, `procedimento_apelidos`, `profissional_excecoes`,
`documentos`, `follow_ups`.

### Funções (RPC)

| Referência | Onde | Banco novo |
|---|---|---|
| `agenda_slots` | `queries.ts:76`, `agenda-demo/route.ts:70` | ❌ **não existe** |
| `agenda_checar` | `queries.ts:96`, `slot-agenda.ts:26` | ❌ **não existe** |
| `agenda_profissionais_na_escala` | `slot-agenda.ts:27` | ❌ **não existe** |

O banco novo oferece, no lugar: `painel_agenda` (painel) e
`agenda_consultar` / `agenda_marcar` / `agenda_alterar` / `agenda_escala`
(service_role). **Nenhuma é chamada por este código ainda.**

### 2.1 Colunas que sumiram ou trocaram de nome

Confirmado em `information_schema`. Isto quebra em silêncio na leitura e com
`42703` na escrita:

| Código espera | Banco novo tem |
|---|---|
| `agendamentos.servico` | `servico_texto` (+ `procedimento_id`) |
| `agendamentos.origem` | — (removida) |
| `agendamentos.profissional` (texto) | `profissional_id` (uuid) |
| `leads.anuncio_origem` | `anuncio_texto`, `anuncio_id`, `anuncio_url`, `anuncio_app`, `anuncio_em` |
| `leads.*` de endereço (`cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `pais`, `documento`, `empresa`, `site`) | — (só `email`, `instagram`, `nascimento`, `anotacoes`, `etiquetas`) |
| `fichas_avaliacao.status` / `.alertas` / `.tipo` / `.preenchida_em` | `tem_alerta boolean` |
| `promocoes.procedimento` / `.valor_promocional` / `.condicao` / `.dia_semana` / `.anuncio_ativo` | `preco`, `valida_de`, `valida_ate`, `ativa` |

E **toda** tabela ganhou `tenant_id uuid NOT NULL` — nenhum `insert` do código
atual preenche isso.

---

## 3. Ocorrências de "VoraX" / "Vora"

30 arquivos (fora de `node_modules`, `.git`, `.next`). `legacy/index.html` e
`package-lock.json` ficam de fora do renome.

**Marca visível / metadados**
`package.json:2` · `src/app/layout.tsx` · `src/app/(site)/layout.tsx` (2) ·
`src/app/(publico)/layout.tsx` · `src/app/(auth)/login/page.tsx` ·
`src/app/(publico)/privacidade/page.tsx` · `src/app/icon.svg` (2) ·
`src/app/apple-icon.svg` (2)

**Componentes de marca do site institucional**
`src/components/site/letras-vorax.ts` (nome do arquivo + 2) ·
`marca-svg.tsx` (3) · `logo.tsx` (2) · `abertura.tsx` (4) · `luz-fundo.tsx` ·
`rodape-site.tsx` · `site-header.tsx` · `src/lib/site.ts`

**Comentário / texto interno**
`app-shell.tsx` · `auth/login-form.tsx` · `conversas/chat-panel.tsx` (3) ·
`conversas/conversas.tsx` · `ficha/ficha-shell.tsx` · `lib/clinica.ts` ·
`lib/som.ts` · `lib/tema.ts` · `src/app/(site)/site.css`

**Tokens CSS** — `--vx-*`: **1.082 ocorrências** em 28 arquivos
(`globals.css` sozinho tem 933). 49 nomes de token distintos.
Utilitários Tailwind derivados (`bg-vx-surface`, `text-vx-muted`, …):
**199 ocorrências**, mapeados no bloco `@theme inline` de `globals.css:52-85`.

⚠️ **Três lugares montam o nome do token por string**, não o escrevem literal —
busca por `--vx-` acha, mas um replace ingênuo de `bg-vx-` não:

- `src/components/dashboard/service-chart.tsx:48` → `` `--vx-cat-${i}` ``
- `src/lib/format.ts:25-30` → array `--vx-av-1..6`
- `src/lib/atribuicao.ts:106-110` → array `--vx-cat-1..5`

**`localStorage`**: a chave do tema é `vorax-theme` (`theme-script.tsx`,
`theme-provider.tsx`). Renomear a chave descarta a preferência salva de quem já
usa; aqui isso é aceitável (banco novo, base nova).

---

## 4. Variáveis de ambiente lidas

| Variável | Onde | No bundle? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `supabase.ts:12`, `supabase-server.ts:13`, `supabase-admin.ts:10`, `middleware.ts:43` | sim (por design) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `supabase.ts:13`, `supabase-server.ts:14`, `middleware.ts:44` | sim (por design) |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase-admin.ts:11` | **não** |
| `EVOLUTION_API_URL` | `evolution.ts:24` | **não** |
| `EVOLUTION_API_KEY` | `evolution.ts:25` | **não** |
| `EVOLUTION_INSTANCE` | `evolution.ts:26` | **não** |

São **6**, e só essas. Nenhuma outra `process.env.` no `src/`.

⚠️ O nome no código é `EVOLUTION_API_URL`, não `EVOLUTION_URL`. E
`EVOLUTION_INSTANCE` é obrigatória (monta o path `/message/sendText/<instancia>`).

---

## 5. Consultas sem teto — o corte silencioso em 1.000 linhas

O PostgREST devolve no máximo 1.000 linhas e **não sinaliza quando corta**.
`buscarTodasAsPaginas` (`src/lib/paginar.ts`) resolve por paginação; quem não
usa nem `.limit()` fica exposto.

**Em `queries.ts` — as duas sem teto:**

| Função | Linha | Risco |
|---|---|---|
| `getAgendamentosByLead` | 203-212 | `select *` de um lead, sem limite. Baixo hoje, ilimitado por construção. |
| `getAgendaSlots` | 72-82 | RPC por intervalo de datas: dias × horas. **Um intervalo largo estoura.** |

Já protegidas: `getLeads`, `getProximasVisitas`, `getAgendamentos`,
`getAgendamentosComLead`, `getUltimaConversaPorLead` (paginam) ·
`getConversasByLead` (cursor, `.limit(50)`) · `getEscala` (`.limit(200)`/`(1000)`) ·
`getLeadById` (`maybeSingle`) · `checarHorario` (1 linha).

**Fora de `queries.ts`** (mesma classe de defeito):

| Arquivo:linha | O que |
|---|---|
| `src/app/api/painel/laura/route.ts:42` | `leads.select("pausada_por").eq("ia_pausada", true)` — **é uma contagem**; acima de 1.000 pausados o número mente |
| `src/lib/ficha-db.ts:25,51,143` | `fichas_avaliacao` |
| `src/lib/promocao-db.ts:20` | `listarPromocoes` |
| `src/components/configuracoes/bloqueios.tsx:22` | `profissional_bloqueios` |
| `src/components/configuracoes/secao-profissionais.tsx:21,23` | `profissionais`, `profissional_horarios` |

---

## 6. Classes CSS nomeadas sem regra

Varredura de 358 classes semânticas usadas em `.tsx` contra `globals.css` +
`site.css`. Descontados os falsos positivos (utilitários Tailwind, variáveis
JS, prefixos montados por template), sobram **duas reais**:

| Classe | Usada em | Situação |
|---|---|---|
| `.metrics-lente` | `dashboard/metrics-grid.tsx:119,163` | só `.metrics-lente-titulo` tem regra (`globals.css:3202`) |
| `.nav-item-footer` | `app-shell.tsx:109` | nenhuma regra em lugar nenhum |

Ambas renderizam sem estilo próprio hoje.

---

## 7. Estado do banco novo (`hcexbbmgfekpaakerfys`)

- **20 tabelas**, todas com RLS ligada. 19 têm `tenant_id uuid NOT NULL`; a
  exceção é `prompt_base` (global, leitura liberada a `authenticated`).
- **Zero views.**
- **Zero buckets de storage** — `midia-conversas` precisa ser criado (Bloco 5).
- **Zero usuários em `auth.users`** e **zero linhas em `usuarios_tenant`**.
  Consequência prática: `tenant_valido()` levanta
  `sem clinica vinculada a esta conta` para todo mundo até alguém ser vinculado.
- **1 tenant**: `lins` / "LINS Estética Avançada" (`e09c414c-…`), com 4
  profissionais, 23 horários, 20 procedimentos, 27 apelidos, 48 vínculos
  profissional×procedimento. `leads`, `conversas` e `agendamentos` estão vazios.

**Policies**: uma por tabela, `FOR ALL TO authenticated`, com
`USING (tenant_id IN (SELECT meus_tenants())) WITH CHECK (idem)`.

**`tenant_valido(p_tenant)`** (`SECURITY DEFINER`, `STABLE`):
`null` → devolve o tenant da conta; um uuid → confere em `usuarios_tenant`
contra `auth.uid()` e **levanta exceção** se não bater. É por isso que passar
`tenant_id` vindo do navegador **para esta função** é seguro — e por isso passar
direto para `agenda_consultar` não é.

**`painel_agenda(p_de, p_ate, p_servico, p_apenas_livres, p_limite, p_tenant)`**
chama `agenda_consultar(tenant_valido(p_tenant), …)`. `p_tenant` é o **último**
parâmetro e tem default `null`.
