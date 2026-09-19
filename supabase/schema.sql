-- ============================================================
-- Mapa Burger — Fechamento de Caixa
-- Schema do Supabase (rodar no SQL Editor)
-- ============================================================

create extension if not exists "pgcrypto";

-- Tabela principal: um registro por turno (manhã/noite) por dia
create table if not exists public.fechamentos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  turno text not null check (turno in ('manha', 'noite')),
  created_at timestamptz not null default now(),

  -- LC
  dinheiro_abertura numeric(12,2) not null default 0,
  dinheiro_fechamento numeric(12,2) not null default 0,
  pix_lc numeric(12,2) not null default 0,
  debito_lc numeric(12,2) not null default 0,
  credito_lc numeric(12,2) not null default 0,
  consumo_loja numeric(12,2) not null default 0,
  a_prazo numeric(12,2) not null default 0,
  ticket numeric(12,2) not null default 0,

  -- Brendi
  pix_brendi numeric(12,2) not null default 0,
  debito_brendi numeric(12,2) not null default 0,
  credito_brendi numeric(12,2) not null default 0,
  credito_online_brendi numeric(12,2) not null default 0,
  dinheiro_brendi numeric(12,2) not null default 0,

  -- Totais calculados (gravados no momento do salvamento)
  total_lc numeric(12,2) not null,
  total_brendi numeric(12,2) not null,
  total_caixa numeric(12,2) not null,

  -- Conferência com o sistema
  total_lc_sistema numeric(12,2) not null default 0,
  total_sistema numeric(12,2) not null,
  diferenca_original numeric(12,2) not null,

  -- Ajuste manual
  ajuste_tipo text check (ajuste_tipo in ('adicionar', 'remover')),
  ajuste_valor numeric(12,2) not null default 0,
  ajuste_aplicado numeric(12,2) not null default 0,

  -- Resultado final
  diferenca_final numeric(12,2) not null,
  status text not null check (status in ('fechou', 'sobrou', 'faltou')),

  observacoes text,

  marmitas_vendidas integer not null default 0,

  -- Um único fechamento por data + turno
  unique (data, turno)
);

create index if not exists idx_fechamentos_data on public.fechamentos (data desc);

-- Sangrias: retiradas de dinheiro do caixa durante o expediente.
-- Sempre precisam de motivo (aplicação valida isso, e o banco também).
create table if not exists public.sangrias (
  id uuid primary key default gen_random_uuid(),
  fechamento_id uuid not null references public.fechamentos (id) on delete cascade,
  valor numeric(12,2) not null check (valor >= 0),
  motivo text not null check (length(trim(motivo)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_sangrias_fechamento on public.sangrias (fechamento_id);

-- ============================================================
-- Row Level Security
-- ============================================================
-- Este é um sistema interno (sem tela de login por enquanto),
-- então as políticas abaixo liberam acesso total via chave anon.
-- Quando o sistema tiver autenticação (funcionário/gerente),
-- essas políticas devem ser trocadas por regras baseadas em
-- auth.uid() / auth.role().

alter table public.fechamentos enable row level security;
alter table public.sangrias enable row level security;

drop policy if exists "fechamentos_all_access" on public.fechamentos;
create policy "fechamentos_all_access" on public.fechamentos
  for all
  using (true)
  with check (true);

drop policy if exists "sangrias_all_access" on public.sangrias;
create policy "sangrias_all_access" on public.sangrias
  for all
  using (true)
  with check (true);

-- ============================================================
-- Relatório diário escrito (sem relação com o fechamento de caixa)
-- Estrutura fixa: cada seção fica em uma coluna jsonb.
-- ============================================================

create table if not exists public.relatorios (
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

  estoque_quente jsonb not null default '{"itens": []}'::jsonb,

  -- Prints anexados (base64), só usados no PDF de WhatsApp
  imagem1 text,
  imagem2 text,

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

-- ============================================================
-- Funcionários (pra selecionar por botão em vez de digitar nome)
-- ============================================================

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
