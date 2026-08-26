# Migrations do painel antigo — NÃO RODAR

Estas cinco vieram no clone e foram escritas para o banco **single-tenant** da
LINS. Nenhuma delas menciona `tenant_id` — conferido: zero ocorrências em todas.

Estão aqui, e não em `migrations/`, porque `supabase db push` varre só o nível
de cima. Numa subpasta elas continuam legíveis e param de ser um gatilho.

## O que aconteceria se rodassem contra o banco do Meraki

`20260712_agenda_profissionais.sql` e `APLICAR_PASSO1.sql` (que é uma cópia
maior da primeira) criam:

| Objeto | Problema |
|---|---|
| `agenda_slots()` | lê a agenda **sem filtrar por clínica** |
| `agenda_checar()` | idem |
| `agenda_profissionais_na_escala()` | idem |
| `agenda_capacidade_legado()` | idem |
| `agendamentos_validar()` | **trigger** que valida escrita sem noção de tenant |

O banco novo já resolve isso com `painel_agenda()` (painel, valida a sessão) e
`agenda_consultar()` (n8n, recebe o tenant pronto). Instalar as antigas por
cima colocaria no ar funções que atravessam clínicas — e o trigger passaria a
opinar sobre toda escrita em `agendamentos`.

`20260811_leads_cadastro_completo.sql` adiciona a `leads` colunas de endereço e
documento que o schema novo não tem e não quer.

`20260712_agenda_seed_escala.sql` insere a escala real da LINS. O tenant `lins`
do banco novo **já tem** as 23 linhas de `profissional_horarios`.

`20260731_idx_conversas_lead_enviado.sql` é a menos perigosa — só um índice
composto em `conversas(lead_id, enviado_em desc)`. Ainda assim, se o índice
fizer falta, escreva uma migration nova conferindo o que já existe no banco em
vez de aplicar esta às cegas.

## Para consultar

O conteúdo continua aqui e no histórico do git. Serve como referência de
*intenção* — por que a agenda deriva capacidade da escala, por exemplo —, nunca
como SQL para executar.
