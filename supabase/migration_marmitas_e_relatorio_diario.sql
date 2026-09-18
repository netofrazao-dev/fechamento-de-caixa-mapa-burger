-- ============================================================
-- Migração: marmitas no fechamento + relatório diário (modelo fixo)
-- Rode isso no SQL Editor do Supabase.
--
-- ATENÇÃO: essa migração APAGA a tabela "relatorios" antiga
-- (o modelo genérico de título+campos livres) e cria uma nova,
-- no formato fixo do relatório diário. Se você já tinha salvo
-- algum relatório no formato antigo, ele será perdido.
-- ============================================================

-- 1) Contagem de marmitas no fechamento de caixa
alter table public.fechamentos
  add column if not exists marmitas_vendidas integer not null default 0;

-- 2) Relatório diário — recria a tabela no novo formato
drop table if exists public.relatorios cascade;

create table public.relatorios (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,

  abertura_caixa numeric(12,2) not null default 0,
  fechamento_caixa numeric(12,2) not null default 0,
  quantidade_vendida integer not null default 0,

  estragou jsonb not null default '[]'::jsonb,
  funcionarios_que_comeram jsonb not null default '[]'::jsonb,

  consumo_loja_mensal jsonb not null default '[]'::jsonb,
  consumo_loja_motoboys jsonb not null default '[]'::jsonb,
  cortesia_clientes jsonb not null default '[]'::jsonb,

  sangrias jsonb not null default '[]'::jsonb,

  estoque_inicio jsonb not null default '{"dataHora": "", "itens": []}'::jsonb,
  estoque_final jsonb not null default '{"dataHora": "", "itens": []}'::jsonb,
  estoque_quente jsonb not null default '[]'::jsonb,

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

-- 3) Funcionários (pra selecionar por botão em vez de digitar nome)
create table if not exists public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);

alter table public.funcionarios enable row level security;

drop policy if exists "funcionarios_all_access" on public.funcionarios;
create policy "funcionarios_all_access" on public.funcionarios
  for all
  using (true)
  with check (true);

insert into public.funcionarios (nome)
values ('Neto'), ('Pâmela'), ('Oneide'), ('Diogo'), ('Luciano')
on conflict (nome) do nothing;
