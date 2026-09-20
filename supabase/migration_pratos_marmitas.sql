-- ============================================================
-- Migração: contagem de marmitas por prato (clique em vez de
-- digitar número), com tabela de pratos cadastrados.
-- Rode isso no SQL Editor do Supabase.
-- ============================================================

-- 1) Nova coluna: lista de {prato, quantidade} em vez de um número só.
alter table public.fechamentos
  add column if not exists marmitas jsonb not null default '[]'::jsonb;

-- 2) Migra o total antigo (se a coluna marmitas_vendidas existir) pra
--    um item genérico "Outros", só pra não perder o histórico.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fechamentos' and column_name = 'marmitas_vendidas'
  ) then
    update public.fechamentos
    set marmitas = jsonb_build_array(jsonb_build_object('prato', 'Outros', 'quantidade', marmitas_vendidas))
    where marmitas_vendidas > 0 and marmitas = '[]'::jsonb;

    alter table public.fechamentos drop column marmitas_vendidas;
  end if;
end $$;

-- 3) Tabela de pratos cadastrados.
create table if not exists public.pratos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);

alter table public.pratos enable row level security;

drop policy if exists "pratos_all_access" on public.pratos;
create policy "pratos_all_access" on public.pratos
  for all
  using (true)
  with check (true);

insert into public.pratos (nome)
values ('Estrogonofe'), ('Frango Grelhado'), ('Bife Acebolado')
on conflict (nome) do nothing;
