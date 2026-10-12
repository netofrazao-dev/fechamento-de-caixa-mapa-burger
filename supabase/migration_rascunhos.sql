-- ============================================================
-- Migração: rascunhos sincronizados entre aparelhos.
-- Rode no SQL Editor do Supabase. Sem isso o rascunho continua
-- funcionando, só que apenas no navegador onde foi preenchido.
-- ============================================================

create table if not exists public.rascunhos (
  chave text primary key,
  dados jsonb not null,
  salvo_em timestamptz not null default now()
);

alter table public.rascunhos enable row level security;

drop policy if exists "rascunhos_all_access" on public.rascunhos;
create policy "rascunhos_all_access" on public.rascunhos for all using (true) with check (true);
