-- Bucket da mídia das conversas.
--
-- PRIVADO, e isso não é conservadorismo: são fotos que clientes mandam para a
-- clínica pelo WhatsApp — muitas de corpo, algumas de área tratada. Bucket
-- público aqui significaria que qualquer pessoa com o link vê a foto de uma
-- paciente, para sempre e sem login. O painel lê por URL assinada de vida
-- curta (/api/painel/midia), nunca por link direto.
--
-- Caminho:  {slug-do-tenant}/{telefone}/{msgId}.{ext}
--
-- O slug como PRIMEIRA pasta é o que torna o escopo verificável por prefixo,
-- tanto aqui na policy quanto na rota que assina. Antes o prefixo era o nome
-- de uma clínica fixa (`lins/`), o que só funciona enquanto existe uma.

insert into storage.buckets (id, name, public)
values ('midia-conversas', 'midia-conversas', false)
on conflict (id) do nothing;

-- Policies de storage.
--
-- A leitura do painel passa por service_role, que ignora RLS — então estas
-- policies não são o que protege o dia a dia; a trava de prefixo em
-- /api/painel/midia é. Elas existem para o caso de alguém ler o bucket com a
-- sessão do usuário: aí o escopo tem que valer também, e valer igual.
--
-- `(storage.foldername(name))[1]` é a primeira pasta do caminho. Comparar a
-- PASTA inteira, e não um prefixo de texto, é o que impede que o tenant
-- `lins` alcance os arquivos de `lins-antiga`.

drop policy if exists "midia_conversas_leitura_tenant" on storage.objects;
create policy "midia_conversas_leitura_tenant"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'midia-conversas'
    and (storage.foldername(name))[1] in (
      select t.slug from public.tenants t
      where t.id in (select public.meus_tenants())
    )
  );

-- Escrita: quem grava mídia é o n8n, com service_role (que não passa por aqui).
-- A policy de insert existe para que uma futura tela de anexo no painel já
-- nasça escrevendo na pasta certa, e não em qualquer uma.
drop policy if exists "midia_conversas_escrita_tenant" on storage.objects;
create policy "midia_conversas_escrita_tenant"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'midia-conversas'
    and (storage.foldername(name))[1] in (
      select t.slug from public.tenants t
      where t.id in (select public.meus_tenants())
    )
  );

-- Sem policy de update/delete de propósito: apagar mídia de conversa é
-- decisão de retenção, não operação de tela. Quando existir, vem com o
-- processo que a justifica.
