-- Índice composto para o histórico do chat paginado por cursor.
--
-- A consulta do chat é sempre a mesma forma:
--   where lead_id = $1 and enviado_em <= $2
--   order by enviado_em desc
--   limit 50
--
-- Hoje existem só `idx_conversas_lead (lead_id)` e `idx_conversas_enviado
-- (enviado_em)`, separados. Com eles o Postgres filtra pelo lead e depois
-- ORDENA todas as linhas daquele lead a cada página — no lead com 1.075
-- mensagens, mil linhas ordenadas 22 vezes para percorrer a conversa.
--
-- Com o composto na mesma direção do ORDER BY, ele caminha o índice e para no
-- quinquagésimo: custo constante por página, que é a premissa da paginação por
-- cursor. É aditivo e reversível (drop index) — não altera dado nem policy.
--
-- CONCURRENTLY para não travar escrita da Laura durante a criação.
-- (Se o runner de migrations rodar em transação, remova o CONCURRENTLY: a
--  tabela tem ~5,7 mil linhas, o lock é de instantes.)

create index concurrently if not exists idx_conversas_lead_enviado
  on public.conversas (lead_id, enviado_em desc);
