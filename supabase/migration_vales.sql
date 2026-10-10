-- ============================================================
-- Migração: sistema de Vales (adiantamento de salário).
-- Rode no SQL Editor do Supabase. Não mexe em nada que já existe.
-- ============================================================

create table if not exists public.vales (
  id uuid primary key default gen_random_uuid(),
  funcionario text not null,
  data date not null default current_date,
  valor numeric(12,2) not null check (valor > 0),
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists idx_vales_data on public.vales (data desc);
create index if not exists idx_vales_funcionario on public.vales (funcionario);

alter table public.vales enable row level security;

drop policy if exists "vales_all_access" on public.vales;
create policy "vales_all_access" on public.vales for all using (true) with check (true);
