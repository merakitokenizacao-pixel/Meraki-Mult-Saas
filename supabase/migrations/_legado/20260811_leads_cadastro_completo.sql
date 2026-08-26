-- Cadastro de lead completo: campos que a ficha do cliente precisa e que hoje
-- não existem em `leads`.
--
-- POR QUE COLUNA E NÃO `memoria`: a coluna `memoria` (jsonb) JÁ É USADA pela
-- Laura — hoje guarda {"preferencias":{"dias":[...],"horarios":[...]}}. Enfiar
-- campos de formulário lá colidiria com o agente, e nenhum dos dois lados
-- saberia de quem é cada chave.
--
-- Tudo é ADITIVO e anulável: nenhum lead existente muda, e o n8n continua
-- fazendo upsert por `telefone` sem enxergar diferença.
--
-- ⚠️ `origem`, `tags`, `score_ia` e `temperatura` foram REMOVIDAS de `leads` em
-- ago/2026. Não estou ressuscitando esses nomes: "como conheceu" vai para a
-- coluna `anuncio_origem`, que já existe, e as etiquetas entram como
-- `etiquetas` para não colidir com o que foi retirado de propósito.

alter table public.leads
  -- Contato
  add column if not exists email        text,
  add column if not exists site         text,
  -- Dados pessoais
  add column if not exists documento    text,   -- CPF ou CNPJ, só dígitos
  add column if not exists empresa      text,
  add column if not exists nascimento   date,
  -- Endereço
  add column if not exists cep          text,   -- só dígitos
  add column if not exists logradouro   text,
  add column if not exists numero       text,   -- texto: existe "s/n" e "123-A"
  add column if not exists complemento  text,
  add column if not exists bairro       text,
  add column if not exists cidade       text,
  add column if not exists uf           text,
  add column if not exists pais         text default 'BR',
  -- Livres
  add column if not exists anotacoes    text,
  add column if not exists etiquetas    text[];

comment on column public.leads.documento is
  'CPF ou CNPJ, somente dígitos. A formatação é da tela.';
comment on column public.leads.nascimento is
  'Data pura, sem fuso: aniversário não muda com timezone.';
comment on column public.leads.anuncio_origem is
  'Como o cliente conheceu a clínica. Reaproveitada pelo cadastro manual.';
comment on column public.leads.etiquetas is
  'Etiquetas livres da equipe (indicação, VIP, alérgica…). Nome diferente de
   `tags`, que foi removida em ago/2026 — não confundir.';

-- Busca por documento e por e-mail acontece quando alguém liga perguntando
-- "sou eu, meu CPF é...". Parcial: a esmagadora maioria dos leads é nula.
create index if not exists idx_leads_documento
  on public.leads (documento) where documento is not null;
create index if not exists idx_leads_email
  on public.leads (lower(email)) where email is not null;
