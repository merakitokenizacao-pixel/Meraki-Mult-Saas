# Meraki

Painel SaaS multi-clínica. Next.js 16 (App Router) + TypeScript + Tailwind v4 +
Supabase.

A arquitetura, as regras de tenant e as armadilhas conhecidas estão em
[CLAUDE.md](CLAUDE.md). O levantamento do código herdado do clone está em
[INVENTARIO.md](INVENTARIO.md).

## Como rodar

```bash
npm install
cp .env.example .env.local   # e preencha os valores
npm run dev
```

Abra http://localhost:3000.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha. São seis, e só essas:

| Variável | Onde pegar | Vai para o navegador? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | sim (por design) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem | sim (por design) |
| `SUPABASE_SERVICE_ROLE_KEY` | idem, seção *service_role* | **não, nunca** |
| `EVOLUTION_API_URL` | painel da Evolution API | **não** |
| `EVOLUTION_API_KEY` | idem | **não** |
| `EVOLUTION_INSTANCE` | nome da instância conectada | **não** |

A `anon key` é pública por design do Supabase — quem protege os dados é a RLS.
A `service_role` **ignora a RLS**: ela nunca leva o prefixo `NEXT_PUBLIC_`, e é
o prefixo que impede o Next de embuti-la no bundle.

As três da Evolution mandam mensagem em nome da clínica. Precisam estar
cadastradas **também na Vercel**, senão o envio quebra em produção sem erro
evidente no build.

## A trava de banco

A aplicação **se recusa a subir** se `NEXT_PUBLIC_SUPABASE_URL` não apontar para
o projeto `hcexbbmgfekpaakerfys`:

```
banco errado — este painel é do Meraki
```

A checagem está em `src/lib/env.ts` e roda no boot (importada pelo
`next.config.ts`), então pega `dev`, `build` e `start`. Ela existe porque este
repositório é um clone do painel antigo, que apontava para o banco de produção
de uma clínica real — é a única defesa automática contra escrever lá por
engano. Não afrouxe a checagem para "testar rápido".

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção — **confira o exit code**, não a saída |
| `npm start` | serve o build |
| `npm run lint` | ESLint |

⚠️ `useSearchParams()` exige `<Suspense>`. Sem ele, o build **compila** e só o
*export* quebra: procurar `✓ Compiled` na saída esconde a falha. O exit code
não mente.

## Banco

Projeto Supabase `hcexbbmgfekpaakerfys`. 20 tabelas, todas com RLS por tenant.
Migrations em `supabase/migrations/`.

A regra que atravessa tudo: **o navegador nunca escolhe o tenant — ele informa,
o banco valida** (`tenant_valido()`). Detalhes em [CLAUDE.md](CLAUDE.md).

## Nota de operação (Windows)

Ao reiniciar o `next dev`, se a porta 3000 aparecer ocupada, há um processo
`next` órfão — encerrar o `npm` não derruba o filho `node`. Ele pode servir CSS
defasado do cache do Turbopack, o que já quebrou a tela visualmente com o
código certo.

`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` mostra as linhas de
comando (evita derrubar node alheio); depois `taskkill //IM node.exe //F`. Se
`rm -rf .next` reclamar "Directory not empty", ainda há `node` segurando o
arquivo — **mate primeiro, apague depois**. E dê hard refresh (Ctrl+Shift+R).

Para diagnosticar se é cache, julgue pelo **conteúdo**, não pelo nome: em dev o
Turbopack mantém o mesmo nome de arquivo mesmo com conteúdo diferente.

```bash
curl -s localhost:3000/ | grep -oE '/_next/static/chunks/[^"]*\.css'
curl -s localhost:3000<arquivo> | grep 'sua-regra'
```

Se a regra nova não está no arquivo servido, o fonte está certo e o servidor
está velho.
