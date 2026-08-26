-- =============================================================================
-- AGENDA — capacidade DERIVADA das profissionais
-- =============================================================================
-- Entrega 1: estrutura + função de disponibilidade + trigger de proteção.
--
-- Contexto (AGENTE.md): três portas escrevem em `agendamentos` — a Laura (n8n),
-- a equipe (painel) e crons. Validar no frontend não protege nada: a garantia
-- mora no banco. Esta migration cria a FONTE ÚNICA que o CRM, o trigger e (depois)
-- as tools da Laura consultam.
--
-- Convenções do AGENTE.md respeitadas:
--   • Nenhuma coluna existente renomeada/removida (o n8n referencia nomes literais).
--   • Timezone SEMPRE explícito: 'America/Sao_Paulo'.
--   • Soft delete: o trigger nunca bloqueia cancelamento.
--   • Toda tabela nova nasce com RLS ligado.
--   • Gate do laser (dias_laser) NÃO entra aqui — capacidade de agenda e
--     elegibilidade de serviço são dimensões diferentes.
--   • Vocabulário de códigos preservado (o prompt da Laura não muda).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. TABELAS
-- -----------------------------------------------------------------------------

create table if not exists public.profissionais (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,              -- unique deixa o seed idempotente
  cor        text not null default '#9b7d5a',   -- hex, usado na agenda
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- Escala semanal. VÁRIAS faixas por profissional por dia — é assim que se
-- representa escala alternada (ex.: 08:00-09:00 e 10:00-11:00 no mesmo dia).
create table if not exists public.profissional_horarios (
  id              uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references public.profissionais(id) on delete cascade,
  dia_semana      smallint not null check (dia_semana between 0 and 6),  -- 0=domingo
  hora_inicio     time not null,
  hora_fim        time not null,
  criado_em       timestamptz not null default now(),
  constraint faixa_valida check (hora_fim > hora_inicio)
);
create index if not exists profissional_horarios_dia_idx
  on public.profissional_horarios (dia_semana, profissional_id);

-- Exceções pontuais: folga, férias, médico. hora_inicio/fim NULL = dia inteiro.
create table if not exists public.profissional_bloqueios (
  id              uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references public.profissionais(id) on delete cascade,
  data            date not null,
  hora_inicio     time,
  hora_fim        time,
  motivo          text,
  criado_em       timestamptz not null default now(),
  constraint bloqueio_faixa_valida check (
    (hora_inicio is null and hora_fim is null)
    or (hora_inicio is not null and hora_fim is not null and hora_fim > hora_inicio)
  )
);
create index if not exists profissional_bloqueios_data_idx
  on public.profissional_bloqueios (data);

-- NULLABLE de propósito: a Laura marca sem atribuir (só verifica se há ALGUÉM
-- livre); a equipe atribui depois pelo painel. Não tornar obrigatória.
alter table public.agendamentos
  add column if not exists profissional_id uuid references public.profissionais(id);
create index if not exists agendamentos_profissional_idx
  on public.agendamentos (profissional_id);

-- Acelera a contagem de ocupação por janela de tempo.
create index if not exists agendamentos_data_status_idx
  on public.agendamentos (data_agendamento) where status <> 'cancelado';

alter table public.profissionais          enable row level security;
alter table public.profissional_horarios  enable row level security;
alter table public.profissional_bloqueios enable row level security;
-- Sem policies: acesso só server-side (service role) e pela credencial do n8n.


-- -----------------------------------------------------------------------------
-- 2. FALLBACK LEGADO
-- -----------------------------------------------------------------------------
-- Enquanto `profissional_horarios` estiver VAZIA, a função reproduz o
-- comportamento REMENDADO das tools atuais: capacidade 1, last start 19h,
-- almoço 12h fora, sábado só manhã, domingo fechado — e a segunda começando
-- só às 13h (o remendo: hoje as tools ignoram a pós-graduação da dona e
-- oferecem segunda de manhã).
-- Assim o trigger pode entrar HOJE sem quebrar a Laura. Quando o seed da
-- escala real entrar, a capacidade da tarde vira 2/3 sozinha — o seed é o
-- INTERRUPTOR da transição.
create or replace function public.agenda_capacidade_legado(p_dow smallint, p_hora int)
returns int
language sql immutable
as $$
  select case
    when p_dow = 0 then 0                                                     -- domingo
    when p_dow = 6 then case when p_hora between 8 and 11 then 1 else 0 end   -- sábado só manhã
    when p_hora = 12 then 0                                                   -- almoço
    when p_dow = 1 then case when p_hora between 13 and 19 then 1 else 0 end  -- segunda: só à tarde
    when p_hora between 8 and 19 then 1                                       -- ter-sex
    else 0
  end;
$$;


-- -----------------------------------------------------------------------------
-- 3. QUEM ESTÁ LIVRE NESSA JANELA
-- -----------------------------------------------------------------------------
-- Profissionais ATIVAS cuja escala cobre a janela INTEIRA [início, fim) e que
-- não têm bloqueio pontual na data. Não desconta ocupação — isso é contado à
-- parte, porque agendamento sem profissional_id consome "alguém", não uma
-- profissional específica.
create or replace function public.agenda_profissionais_na_escala(
  p_inicio      timestamptz,
  p_duracao_min int default 60
)
returns table (profissional_id uuid, nome text)
language sql stable security definer
set search_path = public
as $$
  with j as (
    select
      (p_inicio at time zone 'America/Sao_Paulo')                              as loc_ini,
      ((p_inicio + make_interval(mins => coalesce(p_duracao_min, 60)))
         at time zone 'America/Sao_Paulo')                                     as loc_fim
  ),
  jj as (
    select
      loc_ini::date                          as dia,
      extract(dow from loc_ini)::smallint    as dow,
      loc_ini::time                          as t_ini,
      loc_fim::time                          as t_fim
    from j
  )
  select p.id, p.nome
  from public.profissionais p, jj
  where p.ativo
    and exists (
      select 1 from public.profissional_horarios h
      where h.profissional_id = p.id
        and h.dia_semana  = jj.dow
        and h.hora_inicio <= jj.t_ini
        and h.hora_fim    >= jj.t_fim      -- a faixa cobre o atendimento inteiro
    )
    and not exists (
      select 1 from public.profissional_bloqueios b
      where b.profissional_id = p.id
        and b.data = jj.dia
        and (
          b.hora_inicio is null                                   -- dia inteiro
          or (b.hora_inicio < jj.t_fim and b.hora_fim > jj.t_ini) -- sobrepõe
        )
    );
$$;


-- -----------------------------------------------------------------------------
-- 4. A FUNÇÃO CENTRAL — checa UM horário
-- -----------------------------------------------------------------------------
-- É esta que o trigger usa, que o CRM usa e que as tools da Laura vão usar
-- (Verificar_Disponibilidade). A saída mantém o VOCABULÁRIO do AGENTE.md, então
-- o prompt dela não muda.
--
-- codigo ∈ DISPONIVEL | DISPONIVEL_SABADO_EXIGE_SINAL_30PCT | OCUPADO |
--          FECHADO_DOMINGO | SABADO_SO_DE_MANHA | ALMOCO_REPASSAR_HUMANO |
--          FORA_DO_HORARIO_08_19 | PROFISSIONAL_FORA_DE_ESCALA | HORARIO_INDISPONIVEL
--
-- (os 2 últimos são NOVOS — nascem porque agora existe escala por profissional;
--  ver a nota no fim do arquivo)
create or replace function public.agenda_checar(
  p_inicio               timestamptz,
  p_duracao_min          int  default 60,
  p_profissional_id      uuid default null,   -- null = "qualquer uma"
  p_ignorar_agendamento  uuid default null    -- p/ revalidar na edição
)
returns table (
  ok          boolean,
  codigo      text,
  motivo      text,
  capacidade  int,
  ocupadas    int,
  livres      int
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_fim         timestamptz;
  v_loc         timestamp;
  v_dow         smallint;
  v_hora        int;
  v_tem_escala  boolean;
  v_cap         int;
  v_ocup        int;
  v_livres      int;
begin
  v_fim  := p_inicio + make_interval(mins => coalesce(p_duracao_min, 60));
  v_loc  := p_inicio at time zone 'America/Sao_Paulo';
  v_dow  := extract(dow  from v_loc)::smallint;
  v_hora := extract(hour from v_loc)::int;

  -- A escala real já foi cadastrada? Enquanto não, cai no fallback legado.
  select exists (
    select 1
    from public.profissional_horarios h
    join public.profissionais p on p.id = h.profissional_id and p.ativo
  ) into v_tem_escala;

  if v_tem_escala then
    select count(*)::int into v_cap
    from public.agenda_profissionais_na_escala(p_inicio, p_duracao_min);
  else
    v_cap := public.agenda_capacidade_legado(v_dow, v_hora);
  end if;

  -- Ocupação: agendamentos não-cancelados que SOBREPÕEM a janela (respeita
  -- duracao_min — um de 90min consome duas horas).
  select count(*)::int into v_ocup
  from public.agendamentos a
  where a.status <> 'cancelado'
    and (p_ignorar_agendamento is null or a.id <> p_ignorar_agendamento)
    and a.data_agendamento < v_fim
    and (a.data_agendamento + make_interval(mins => coalesce(a.duracao_min, 60))) > p_inicio;

  v_livres := greatest(v_cap - v_ocup, 0);

  -- ---- horário fechado ------------------------------------------------------
  if v_cap = 0 then
    return query select
      false,
      case
        when v_dow = 0                    then 'FECHADO_DOMINGO'
        when v_dow = 6 and v_hora >= 12   then 'SABADO_SO_DE_MANHA'
        when v_hora = 12                  then 'ALMOCO_REPASSAR_HUMANO'
        when v_hora < 8 or v_hora > 19    then 'FORA_DO_HORARIO_08_19'
        else 'HORARIO_INDISPONIVEL'
      end,
      case
        when v_dow = 0                    then 'Fechado aos domingos'
        when v_dow = 6 and v_hora >= 12   then 'Sábado: só atendemos de manhã'
        when v_hora = 12                  then 'Horário de almoço'
        when v_hora < 8 or v_hora > 19    then 'Fora do horário de atendimento'
        else 'Nenhuma profissional na escala deste horário'
      end,
      0, v_ocup, 0;
    return;
  end if;

  -- ---- profissional específica pedida (atribuição pelo painel) --------------
  if p_profissional_id is not null then
    -- ela está na escala e sem bloqueio nessa janela?
    if not exists (
      select 1 from public.agenda_profissionais_na_escala(p_inicio, p_duracao_min) pl
      where pl.profissional_id = p_profissional_id
    ) then
      return query select
        false, 'PROFISSIONAL_FORA_DE_ESCALA',
        'A profissional não atende nesse horário',
        v_cap, v_ocup, v_livres;
      return;
    end if;

    -- ela já tem outro atendimento sobrepondo?
    if exists (
      select 1 from public.agendamentos a
      where a.profissional_id = p_profissional_id
        and a.status <> 'cancelado'
        and (p_ignorar_agendamento is null or a.id <> p_ignorar_agendamento)
        and a.data_agendamento < v_fim
        and (a.data_agendamento + make_interval(mins => coalesce(a.duracao_min, 60))) > p_inicio
    ) then
      return query select
        false, 'OCUPADO',
        'A profissional já tem atendimento nesse horário',
        v_cap, v_ocup, v_livres;
      return;
    end if;
  end if;

  -- ---- sem vaga (todas as profissionais do horário já ocupadas) -------------
  if v_livres <= 0 then
    return query select
      false, 'OCUPADO',
      case when v_cap = 1
        then 'Sem vaga: a única profissional do horário já está ocupada'
        else 'Sem vaga: as ' || v_cap || ' profissionais já estão ocupadas'
      end,
      v_cap, v_ocup, 0;
    return;
  end if;

  -- ---- disponível -----------------------------------------------------------
  -- Sábado mantém o código que a Laura já conhece (exige sinal de 30%).
  return query select
    true,
    case when v_dow = 6 then 'DISPONIVEL_SABADO_EXIGE_SINAL_30PCT' else 'DISPONIVEL' end,
    'Disponível',
    v_cap, v_ocup, v_livres;
end;
$$;


-- -----------------------------------------------------------------------------
-- 5. GRADE DE UM PERÍODO — o que o CRM desenha e o Horarios_Livres consome
-- -----------------------------------------------------------------------------
create or replace function public.agenda_slots(
  p_de           date,
  p_ate          date,
  p_duracao_min  int default 60
)
returns table (
  data        date,
  hora        int,
  capacidade  int,
  ocupadas    int,
  livres      int,
  fechado     boolean,
  codigo      text,
  motivo      text
)
language sql stable security definer
set search_path = public
as $$
  select
    d::date,
    h,
    c.capacidade,
    c.ocupadas,
    c.livres,
    (c.capacidade = 0) as fechado,
    c.codigo,
    c.motivo
  from generate_series(p_de, p_ate, interval '1 day') d
  cross join generate_series(8, 20) h
  cross join lateral public.agenda_checar(
    ((d::date + make_time(h, 0, 0)) at time zone 'America/Sao_Paulo'),
    p_duracao_min
  ) c;
$$;


-- -----------------------------------------------------------------------------
-- 6. TRIGGER — a garantia
-- -----------------------------------------------------------------------------
-- Recusa insert/update que estoure a capacidade, caia em horário fechado ou
-- fora da escala da profissional atribuída. Vale para as TRÊS portas: Laura,
-- painel e qualquer script.
--
-- Cenários de regressão do AGENTE.md que NÃO podem quebrar:
--   • insert do n8n (origem='ia', duracao 60, status 'pendente', prof null) → valida normal
--   • cancelamento (status → 'cancelado')            → sai antes de validar
--   • auto-realizado (status → 'realizado')          → sai antes de validar
--   • lembrete (update de lembrete_enviado)          → nada de horário mudou → sai
--   • reagendamento (update de data_agendamento)     → VALIDA o destino (correto)
--   • atribuir profissional pelo painel              → VALIDA a escala dela (correto)
create or replace function public.agendamentos_validar()
returns trigger
language plpgsql
as $$
declare
  r record;
begin
  -- Só protegemos marcações vivas. Cancelado e realizado são histórico:
  -- bloqueá-los quebraria o soft delete e o cron de auto-realizado.
  if NEW.status is distinct from 'pendente' and NEW.status is distinct from 'confirmado' then
    return NEW;
  end if;

  -- UPDATE que não mexe em horário/duração/profissional (ex.: lembrete_enviado,
  -- observacoes, valor) não precisa revalidar.
  if TG_OP = 'UPDATE'
     and NEW.data_agendamento is not distinct from OLD.data_agendamento
     and NEW.duracao_min      is not distinct from OLD.duracao_min
     and NEW.profissional_id  is not distinct from OLD.profissional_id
     and NEW.status           is not distinct from OLD.status
  then
    return NEW;
  end if;

  select * into r
  from public.agenda_checar(
    NEW.data_agendamento,
    coalesce(NEW.duracao_min, 60),
    NEW.profissional_id,
    NEW.id                       -- não conta a si mesmo ao revalidar
  );

  if not r.ok then
    raise exception 'AGENDA_RECUSADO: % [%]', r.motivo, r.codigo
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

-- NÃO CRIADO AINDA — ver a nota de rollout no fim. Descomentar na fase 2:
--
-- create trigger trg_agendamentos_validar
--   before insert or update on public.agendamentos
--   for each row execute function public.agendamentos_validar();


-- -----------------------------------------------------------------------------
-- 7. PERMISSÕES
-- -----------------------------------------------------------------------------
-- Frontend acessa server-side (service role), como manda o AGENTE.md.
-- O n8n usa a credencial Postgres dele (owner) e não depende destes grants.
revoke execute on function public.agenda_checar(timestamptz, int, uuid, uuid)   from public, anon;
revoke execute on function public.agenda_slots(date, date, int)                 from public, anon;
revoke execute on function public.agenda_profissionais_na_escala(timestamptz, int) from public, anon;
grant  execute on function public.agenda_checar(timestamptz, int, uuid, uuid)   to service_role;
grant  execute on function public.agenda_slots(date, date, int)                 to service_role;
grant  execute on function public.agenda_profissionais_na_escala(timestamptz, int) to service_role;


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


-- =============================================================================
-- CONFERÊNCIA AUTOMÁTICA — roda junto e imprime a curva. Compare com:
--   SEG     0 0 0 0 0 2 3 3 3 3 1 1 0
--   TER–SEX 1 1 1 1 0 2 3 3 3 3 1 1 0
--   SÁB     1 1 1 1 0 0 0 0 0 0 0 0 0
--   DOM     0 0 0 0 0 0 0 0 0 0 0 0 0
-- =============================================================================
select
  to_char(d, 'Dy')                                  as dia,
  string_agg(s.capacidade::text, ' ' order by h.hora) as curva_8h_ate_20h
from generate_series(date '2026-07-13', date '2026-07-19', interval '1 day') d
cross join generate_series(8, 20) h(hora)
cross join lateral public.agenda_checar(
  ((d::date + make_time(h.hora, 0, 0)) at time zone 'America/Sao_Paulo')
) s
group by d
order by d;
