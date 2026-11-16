-- UTI PEDEC-Nacala: tabela dos indicadores. Cole tudo no Supabase > SQL Editor > Run.
create table if not exists public.dados (
  id int primary key check (id = 1),
  conteudo jsonb not null default '{}'::jsonb check (octet_length(conteudo::text) < 200000),
  atualizado timestamptz not null default now(),
  por text
);
alter table public.dados enable row level security;

grant select on public.dados to anon, authenticated;
grant insert, update on public.dados to authenticated;

drop policy if exists "leitura publica" on public.dados;
create policy "leitura publica" on public.dados for select to anon, authenticated using (true);
drop policy if exists "editores inserem" on public.dados;
create policy "editores inserem" on public.dados for insert to authenticated with check (id = 1);
drop policy if exists "editores actualizam" on public.dados;
create policy "editores actualizam" on public.dados for update to authenticated using (id = 1) with check (id = 1);

-- regista automaticamente quem gravou e quando
create or replace function public.dados_autor() returns trigger language plpgsql as $$
begin
  new.por := auth.jwt() ->> 'email';
  new.atualizado := now();
  return new;
end $$;
drop trigger if exists dados_autor on public.dados;
create trigger dados_autor before insert or update on public.dados
  for each row execute function public.dados_autor();

insert into public.dados (id, conteudo) values (1, '{}'::jsonb) on conflict (id) do nothing;
