-- ============================================================
-- Migração: adiciona a tabela de Relatório livre
-- Rode isso no SQL Editor se o banco já existia antes dessa
-- funcionalidade (não precisa rodar o schema.sql inteiro de novo).
-- ============================================================

create table if not exists public.relatorios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default '',
  data date not null default current_date,
  itens jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_relatorios_data on public.relatorios (data desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_relatorios_updated_at on public.relatorios;
create trigger trg_relatorios_updated_at
  before update on public.relatorios
  for each row execute function public.set_updated_at();

alter table public.relatorios enable row level security;

drop policy if exists "relatorios_all_access" on public.relatorios;
create policy "relatorios_all_access" on public.relatorios
  for all
  using (true)
  with check (true);
