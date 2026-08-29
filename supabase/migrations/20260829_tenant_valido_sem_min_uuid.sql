-- tenant_valido(null) estava derrubando TODA rota de /api/painel.
--
-- A função resolvia o caso implícito (conta com uma clínica só) assim:
--
--   select count(*), min(tenant_id) into n, v
--   from public.usuarios_tenant where user_id = auth.uid();
--
-- `usuarios_tenant.tenant_id` é uuid, e o Postgres NÃO TEM agregado
-- `min(uuid)`. A linha roda ANTES do `if n = 0`, então ela explodia sempre que
-- `p_tenant` vinha nulo — que é exatamente o caso de quem tem uma clínica só,
-- porque aí o navegador não manda o cabeçalho `x-meraki-tenant`.
--
--   ERROR: 42883: function min(uuid) does not exist
--   CONTEXT: PL/pgSQL function tenant_valido(uuid) line 13
--
-- Efeito: 500 em servicos, follow-ups, kanban, laura, midia, promocoes, ficha,
-- leads-ativos e enviar-mensagem. As telas que leem pelo navegador (Conversas,
-- Agenda) escapavam porque vão por RLS e não passam por aqui.
--
-- A CORREÇÃO troca o agregado, não a semântica. `(array_agg(tenant_id order by
-- tenant_id))[1]` funciona com uuid e é DETERMINÍSTICO — importa menos neste
-- ramo (ele só é alcançado com n = 1) e mais como garantia: se um dia alguém
-- afrouxar a checagem de n, a função não passa a devolver "a primeira linha que
-- o Postgres quiser", que foi o defeito que esta função já teve uma vez.
--
-- Contagem, os dois errcodes (42501 sem vínculo / acesso negado, 22023 mais de
-- um vínculo) e o caminho de `p_tenant` não nulo ficam idênticos.

create or replace function public.tenant_valido(p_tenant uuid)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v uuid; n int;
begin
  if p_tenant is not null then
    if not exists (select 1 from public.usuarios_tenant
                   where user_id = auth.uid() and tenant_id = p_tenant) then
      raise exception 'acesso negado a esta clinica'
        using errcode = '42501';
    end if;
    return p_tenant;
  end if;

  -- era `min(tenant_id)`, que não existe para uuid
  select count(*), (array_agg(tenant_id order by tenant_id))[1] into n, v
  from public.usuarios_tenant where user_id = auth.uid();

  if n = 0 then
    raise exception 'sem clinica vinculada a esta conta' using errcode = '42501';
  elsif n > 1 then
    raise exception 'informe a clinica: esta conta tem % vinculos', n
      using errcode = '22023';
  end if;
  return v;
end;
$function$;
