-- =============================================================================
-- SEED da escala real — este arquivo é o INTERRUPTOR da transição.
-- =============================================================================
-- Enquanto `profissional_horarios` está vazia, `agenda_checar` cai no fallback
-- legado (capacidade 1, comportamento remendado das tools). No instante em que
-- este seed roda, a capacidade real (2 às 13h, 3 das 14h às 17h) entra no ar —
-- e a segunda de manhã fecha de verdade.
--
-- CONSEQUÊNCIA: as tools da Laura precisam estar migradas para `agenda_checar`
-- ANTES (ou logo depois) disto, senão ela continua oferecendo segunda de manhã
-- (e recusando as 2ª/3ª vagas da tarde, que agora existem).
--
-- Nomes PROVISÓRIOS (Staff1-3). Renomear quando a dona liberar:
--   update public.profissionais set nome = 'Nome Real' where nome = 'Staff1';
-- (o resto não muda — os horários referenciam o id, não o nome)
--
-- Convenção: `hora_fim` é o FIM DO EXPEDIENTE. O último slot iniciável é
-- hora_fim menos a duração — expediente até 20:00 com 60min → última marcação
-- às 19:00. É por isso que `agenda_profissionais_na_escala` exige que a faixa
-- cubra a janela INTEIRA (hora_fim >= fim do atendimento).
-- =============================================================================

insert into public.profissionais (nome, cor, ativo) values
  ('Staff1', '#9b7d5a', true),   -- a dona
  ('Staff2', '#3a6b4f', true),
  ('Staff3', '#2a5278', true)
on conflict (nome) do nothing;

-- Idempotência: reaplicar o seed não pode duplicar faixa. Limpa a escala destas
-- três antes de reinserir. (Não toca em bloqueios nem em agendamentos.)
delete from public.profissional_horarios
 where profissional_id in (
   select id from public.profissionais where nome in ('Staff1','Staff2','Staff3')
 );


-- ── Staff1 (a dona) ──────────────────────────────────────────────────────────
-- seg 13:00–20:00 (manhã na pós-graduação)
-- ter–sex 08:00–12:00 + 13:00–20:00   ← o buraco 12:00–13:00 É o almoço.
--                                       Não existe "regra de almoço": ele
--                                       EMERGE do intervalo entre as faixas.
-- sáb 08:00–12:00
insert into public.profissional_horarios (profissional_id, dia_semana, hora_inicio, hora_fim)
select p.id, 1::smallint, '13:00'::time, '20:00'::time
  from public.profissionais p where p.nome = 'Staff1'
union all
select p.id, d::smallint, '08:00'::time, '12:00'::time
  from public.profissionais p, generate_series(2, 5) d where p.nome = 'Staff1'
union all
select p.id, d::smallint, '13:00'::time, '20:00'::time
  from public.profissionais p, generate_series(2, 5) d where p.nome = 'Staff1'
union all
select p.id, 6::smallint, '08:00'::time, '12:00'::time
  from public.profissionais p where p.nome = 'Staff1';

-- ── Staff2 — seg a sex, 13:00–18:00 ─────────────────────────────────────────
insert into public.profissional_horarios (profissional_id, dia_semana, hora_inicio, hora_fim)
select p.id, d::smallint, '13:00'::time, '18:00'::time
  from public.profissionais p, generate_series(1, 5) d where p.nome = 'Staff2';

-- ── Staff3 — seg a sex, 14:00–18:00 ─────────────────────────────────────────
insert into public.profissional_horarios (profissional_id, dia_semana, hora_inicio, hora_fim)
select p.id, d::smallint, '14:00'::time, '18:00'::time
  from public.profissionais p, generate_series(1, 5) d where p.nome = 'Staff3';


-- =============================================================================
-- CONFERÊNCIA — a curva que estas escalas produzem (para 60 min):
--
--   uma profissional conta na hora H se a faixa dela cobre [H, H+1) inteira
--
--   SEG      08–11h  0   (só Staff1 trabalha de manhã e ela está na pós)
--            12h     0
--            13h     2   (Staff1 13-20 + Staff2 13-18)
--            14–17h  3   (+ Staff3 14-18)
--            18h     1   (Staff2/Staff3 terminam 18:00 → não cobrem [18,19))
--            19h     1   (Staff1, que vai até 20:00)
--   TER–SEX  08–11h  1   (Staff1 08-12; às 11h cobre [11,12) ✓)
--            12h     0   (buraco entre as faixas = almoço)
--            13h     2 · 14–17h  3 · 18h 1 · 19h 1
--   SÁB      08–11h  1   (Staff1) · resto 0
--   DOM      0
--
-- Rodar depois de aplicar, para confirmar contra a tabela acima:
--
--   select to_char(d, 'Dy') dia, h.hora, s.capacidade
--   from generate_series(date '2026-07-13', date '2026-07-19', interval '1 day') d
--   cross join generate_series(8, 20) h(hora)
--   cross join lateral agenda_checar(
--     ((d::date + make_time(h.hora, 0, 0)) at time zone 'America/Sao_Paulo')) s
--   order by d, h.hora;
-- =============================================================================
