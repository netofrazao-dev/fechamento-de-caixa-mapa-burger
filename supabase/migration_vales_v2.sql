-- ============================================================
-- Migração: Vales v2 — robustez para desconto em folha.
--
-- Rode no SQL Editor do Supabase (depois de migration_vales.sql).
-- Pode rodar mais de uma vez sem problema. Não apaga nenhum vale.
--
-- O que muda:
--  1. Cada vale fica ligado ao cadastro do funcionário (funcionario_id).
--     Nomes digitados diferente ("pamela", "Pâmela ") caem na MESMA pessoa.
--  2. Vale nunca é apagado de verdade: excluir só marca como excluído
--     (com motivo), e dá pra restaurar. Vale até pra versão antiga do app.
--  3. Histórico de tudo: criação, alteração, exclusão, restauração,
--     fechamento e reabertura de mês (tabela vales_historico).
--  4. Fechamento do mês: depois de descontar na folha, o mês é travado.
--     Ninguém consegue lançar, editar ou excluir vale de mês fechado
--     (o próprio banco bloqueia). O fechamento guarda um resumo com o
--     total de cada funcionário naquele momento.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- Nome normalizado: sem acento, minúsculo, espaços únicos.
-- "  Pâmela  Silva " -> "pamela silva"
-- ------------------------------------------------------------
create or replace function public.normalizar_nome(t text)
returns text
language sql
immutable
as $$
  select translate(
    lower(regexp_replace(btrim(coalesce(t, '')), '\s+', ' ', 'g')),
    'áàâãäåéèêëíìîïóòôõöúùûüçñý',
    'aaaaaaeeeeiiiiooooouuuucny'
  )
$$;

-- ------------------------------------------------------------
-- Funcionários: nome não pode ser vazio e não pode repetir
-- (ignorando acento/maiúscula).
-- ------------------------------------------------------------
alter table public.funcionarios drop constraint if exists funcionarios_nome_nao_vazio;
alter table public.funcionarios
  add constraint funcionarios_nome_nao_vazio check (length(btrim(nome)) > 0) not valid;

-- ------------------------------------------------------------
-- Vales: novas colunas
-- ------------------------------------------------------------
alter table public.vales add column if not exists funcionario_id uuid;
alter table public.vales add column if not exists updated_at timestamptz not null default now();
alter table public.vales add column if not exists excluido_em timestamptz;
alter table public.vales add column if not exists motivo_exclusao text;

alter table public.vales drop constraint if exists vales_funcionario_id_fkey;
alter table public.vales
  add constraint vales_funcionario_id_fkey
  foreign key (funcionario_id) references public.funcionarios (id)
  on update cascade on delete restrict;

alter table public.vales drop constraint if exists vales_funcionario_nao_vazio;
alter table public.vales
  add constraint vales_funcionario_nao_vazio check (length(btrim(funcionario)) > 0) not valid;

alter table public.vales drop constraint if exists vales_observacao_tamanho;
alter table public.vales
  add constraint vales_observacao_tamanho check (observacao is null or length(observacao) <= 300) not valid;

alter table public.vales drop constraint if exists vales_exclusao_com_motivo;
alter table public.vales
  add constraint vales_exclusao_com_motivo
  check (excluido_em is null or length(btrim(coalesce(motivo_exclusao, ''))) > 0);

create index if not exists idx_vales_funcionario_id on public.vales (funcionario_id);
create index if not exists idx_vales_data_ativos on public.vales (data) where excluido_em is null;

-- Triggers são recriados no fim; desliga aqui pra o ajuste dos dados antigos
-- não gerar histórico falso.
drop trigger if exists trg_vales_antes_gravar on public.vales;
drop trigger if exists trg_vales_antes_excluir on public.vales;
drop trigger if exists trg_vales_historico on public.vales;

-- ------------------------------------------------------------
-- Liga os vales antigos ao cadastro de funcionários.
-- Quem não estiver cadastrado é cadastrado agora.
-- ------------------------------------------------------------
insert into public.funcionarios (nome)
select distinct on (public.normalizar_nome(v.funcionario))
       regexp_replace(btrim(v.funcionario), '\s+', ' ', 'g')
from public.vales v
where length(btrim(v.funcionario)) > 0
  and not exists (
    select 1 from public.funcionarios f
    where public.normalizar_nome(f.nome) = public.normalizar_nome(v.funcionario)
  )
order by public.normalizar_nome(v.funcionario), v.created_at
on conflict do nothing;

update public.vales v
set funcionario_id = (
  select f.id from public.funcionarios f
  where public.normalizar_nome(f.nome) = public.normalizar_nome(v.funcionario)
  order by f.created_at, f.id
  limit 1
)
where v.funcionario_id is null;

-- Impede cadastro duplicado (só cria se hoje não houver duplicados).
do $$
begin
  if exists (
    select 1 from public.funcionarios
    group by public.normalizar_nome(nome) having count(*) > 1
  ) then
    raise notice 'Há funcionários com nomes repetidos (ignorando acento/maiúscula). '
                 'Junte-os e rode a migração de novo para ativar a trava de duplicados.';
  else
    create unique index if not exists funcionarios_nome_normalizado_uk
      on public.funcionarios (public.normalizar_nome(nome));
  end if;
end
$$;

-- ------------------------------------------------------------
-- Meses fechados (já descontados na folha)
-- ------------------------------------------------------------
create table if not exists public.vales_meses_fechados (
  mes date primary key check (extract(day from mes) = 1),
  fechado_em timestamptz not null default now(),
  total numeric(12,2) not null,
  quantidade integer not null,
  -- [{ "funcionario_id": "...", "funcionario": "Neto", "total": 150.00, "quantidade": 2 }]
  resumo jsonb not null default '[]'::jsonb,
  observacao text
);

-- ------------------------------------------------------------
-- Histórico (só cresce; o app não consegue alterar nem apagar)
-- ------------------------------------------------------------
create table if not exists public.vales_historico (
  id bigint generated always as identity primary key,
  registrado_em timestamptz not null default now(),
  -- 'criado' | 'alterado' | 'excluido' | 'restaurado' | 'mes_fechado' | 'mes_reaberto'
  operacao text not null,
  vale_id uuid,
  mes date,
  antes jsonb,
  depois jsonb,
  detalhe text
);

alter table public.vales_historico add column if not exists usuario text;

create index if not exists idx_vales_historico_mes on public.vales_historico (mes, registrado_em desc);
create index if not exists idx_vales_historico_vale on public.vales_historico (vale_id, registrado_em desc);

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
-- E-mail de quem está logado (vem do login do Supabase). null = sem login.
create or replace function public.email_usuario_atual()
returns text
language sql
stable
as $$
  select lower(nullif(nullif(current_setting('request.jwt.claims', true), ''), 'null')::jsonb ->> 'email')
$$;

-- Ponto único de verificação de permissão nas funções abaixo.
-- Aqui ela não bloqueia nada; migration_v4_seguranca.sql troca por
-- uma versão que exige usuário logado e autorizado. Só é criada se
-- ainda não existir, pra não desfazer a v4 ao rodar esta de novo.
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'exigir_usuario_autorizado'
  ) then
    execute $f$
      create function public.exigir_usuario_autorizado() returns void
      language plpgsql stable as $b$ begin return; end; $b$
    $f$;
  end if;
end
$$;

create or replace function public.vales_mes_esta_fechado(p_data date)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.vales_meses_fechados
    where mes = date_trunc('month', p_data)::date
  )
$$;

create or replace function public.vales_formatar_mes(p_data date)
returns text
language sql
immutable
as $$
  select to_char(p_data, 'MM/YYYY')
$$;

-- ------------------------------------------------------------
-- Antes de gravar: valida, liga ao funcionário e respeita mês fechado
-- ------------------------------------------------------------
create or replace function public.vales_antes_gravar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nome text;
begin
  -- Mês fechado: nada entra, nada sai, nada muda.
  if public.vales_mes_esta_fechado(new.data) then
    raise exception 'O mês % já foi fechado (vales descontados na folha). Reabra o mês para alterar.',
      public.vales_formatar_mes(new.data)
      using errcode = 'P0001', hint = 'MES_FECHADO';
  end if;
  if tg_op = 'UPDATE' and public.vales_mes_esta_fechado(old.data) then
    raise exception 'O mês % já foi fechado (vales descontados na folha). Reabra o mês para alterar.',
      public.vales_formatar_mes(old.data)
      using errcode = 'P0001', hint = 'MES_FECHADO';
  end if;

  -- Vale excluído não pode ser editado; só restaurado.
  if tg_op = 'UPDATE' and old.excluido_em is not null and new.excluido_em is not null then
    raise exception 'Este vale foi excluído. Restaure-o antes de editar.'
      using errcode = 'P0001', hint = 'VALE_EXCLUIDO';
  end if;

  if new.valor is null or new.valor <= 0 then
    raise exception 'O valor do vale precisa ser maior que zero.' using errcode = '23514';
  end if;

  new.funcionario := regexp_replace(btrim(coalesce(new.funcionario, '')), '\s+', ' ', 'g');
  new.observacao := nullif(btrim(coalesce(new.observacao, '')), '');

  -- Trocou o nome sem trocar o id (versão antiga do app): procura de novo.
  if tg_op = 'UPDATE'
     and new.funcionario is distinct from old.funcionario
     and new.funcionario_id is not distinct from old.funcionario_id then
    new.funcionario_id := null;
  end if;

  if new.funcionario_id is null then
    if length(new.funcionario) = 0 then
      raise exception 'Informe o funcionário do vale.' using errcode = '23514';
    end if;

    select f.id into v_id
    from public.funcionarios f
    where public.normalizar_nome(f.nome) = public.normalizar_nome(new.funcionario)
    order by f.created_at, f.id
    limit 1;

    if v_id is null then
      insert into public.funcionarios (nome) values (new.funcionario)
      on conflict do nothing
      returning id into v_id;

      if v_id is null then -- outro aparelho cadastrou no mesmo instante
        select f.id into v_id
        from public.funcionarios f
        where public.normalizar_nome(f.nome) = public.normalizar_nome(new.funcionario)
        order by f.created_at, f.id
        limit 1;
      end if;
    end if;

    new.funcionario_id := v_id;
  end if;

  -- O nome gravado no vale é sempre o nome do cadastro.
  select f.nome into v_nome from public.funcionarios f where f.id = new.funcionario_id;
  if v_nome is null then
    raise exception 'Funcionário não encontrado no cadastro.' using errcode = '23503';
  end if;
  new.funcionario := v_nome;

  if new.excluido_em is null then
    new.motivo_exclusao := null;
  end if;

  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
  else
    new.created_at := old.created_at; -- data de criação não muda
  end if;
  new.updated_at := now();

  return new;
end;
$$;

-- ------------------------------------------------------------
-- Excluir = marcar como excluído (nunca apaga de verdade).
-- Garante isso até para a versão antiga do app, que faz DELETE.
-- ------------------------------------------------------------
create or replace function public.vales_antes_excluir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.vales_mes_esta_fechado(old.data) then
    raise exception 'O mês % já foi fechado (vales descontados na folha). Reabra o mês para alterar.',
      public.vales_formatar_mes(old.data)
      using errcode = 'P0001', hint = 'MES_FECHADO';
  end if;

  if old.excluido_em is null then
    update public.vales
    set excluido_em = now(),
        motivo_exclusao = 'Excluído (motivo não informado)'
    where id = old.id;
  end if;

  return null; -- cancela o DELETE físico
end;
$$;

-- ------------------------------------------------------------
-- Histórico de cada mudança em vales
-- ------------------------------------------------------------
create or replace function public.vales_registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operacao text;
  v_detalhe text;
begin
  if tg_op = 'INSERT' then
    v_operacao := 'criado';
  elsif old.excluido_em is null and new.excluido_em is not null then
    v_operacao := 'excluido';
    v_detalhe := new.motivo_exclusao;
  elsif old.excluido_em is not null and new.excluido_em is null then
    v_operacao := 'restaurado';
  else
    -- Nada relevante mudou: não polui o histórico.
    if (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
      return null;
    end if;
    v_operacao := 'alterado';
  end if;

  insert into public.vales_historico (operacao, vale_id, mes, antes, depois, detalhe, usuario)
  values (
    v_operacao,
    new.id,
    date_trunc('month', new.data)::date,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new),
    v_detalhe,
    public.email_usuario_atual()
  );

  -- Vale mudou de mês: registra também no mês de origem.
  if tg_op = 'UPDATE' and date_trunc('month', old.data) <> date_trunc('month', new.data) then
    insert into public.vales_historico (operacao, vale_id, mes, antes, depois, detalhe, usuario)
    values (v_operacao, new.id, date_trunc('month', old.data)::date, to_jsonb(old), to_jsonb(new),
            'Vale movido para ' || public.vales_formatar_mes(new.data), public.email_usuario_atual());
  end if;

  return null;
end;
$$;

create trigger trg_vales_antes_gravar
  before insert or update on public.vales
  for each row execute function public.vales_antes_gravar();

create trigger trg_vales_antes_excluir
  before delete on public.vales
  for each row execute function public.vales_antes_excluir();

create trigger trg_vales_historico
  after insert or update on public.vales
  for each row execute function public.vales_registrar_historico();

-- ------------------------------------------------------------
-- Fechar / reabrir mês (chamados pelo app via supabase.rpc)
-- ------------------------------------------------------------
create or replace function public.fechar_mes_vales(p_mes date, p_observacao text default null)
returns public.vales_meses_fechados
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes date := date_trunc('month', p_mes)::date;
  v_resumo jsonb;
  v_total numeric(12,2);
  v_qtd integer;
  v_linha public.vales_meses_fechados;
begin
  perform public.exigir_usuario_autorizado();
  if p_mes is null then
    raise exception 'Informe o mês.' using errcode = '22004';
  end if;
  if exists (select 1 from public.vales_meses_fechados where mes = v_mes) then
    raise exception 'O mês % já está fechado.', public.vales_formatar_mes(v_mes)
      using errcode = 'P0001', hint = 'MES_FECHADO';
  end if;

  -- Trava os vales do mês enquanto calcula, pra nada entrar no meio.
  perform 1 from public.vales
  where data >= v_mes and data < (v_mes + interval '1 month')
  for update;

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'funcionario_id', t.funcionario_id,
        'funcionario', t.funcionario,
        'total', t.total,
        'quantidade', t.quantidade
      ) order by public.normalizar_nome(t.funcionario)
    ), '[]'::jsonb),
    coalesce(sum(t.total), 0),
    coalesce(sum(t.quantidade), 0)
  into v_resumo, v_total, v_qtd
  from (
    select v.funcionario_id,
           coalesce(f.nome, min(v.funcionario)) as funcionario,
           sum(v.valor) as total,
           count(*)::int as quantidade
    from public.vales v
    left join public.funcionarios f on f.id = v.funcionario_id
    where v.excluido_em is null
      and v.data >= v_mes and v.data < (v_mes + interval '1 month')
    group by v.funcionario_id, f.nome
  ) t;

  insert into public.vales_meses_fechados (mes, total, quantidade, resumo, observacao)
  values (v_mes, v_total, v_qtd, v_resumo, nullif(btrim(coalesce(p_observacao, '')), ''))
  returning * into v_linha;

  insert into public.vales_historico (operacao, mes, depois, detalhe, usuario)
  values ('mes_fechado', v_mes, to_jsonb(v_linha), v_linha.observacao, public.email_usuario_atual());

  return v_linha;
end;
$$;

create or replace function public.reabrir_mes_vales(p_mes date, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes date := date_trunc('month', p_mes)::date;
  v_linha public.vales_meses_fechados;
begin
  perform public.exigir_usuario_autorizado();
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'Informe o motivo para reabrir o mês.' using errcode = '23514';
  end if;

  delete from public.vales_meses_fechados where mes = v_mes returning * into v_linha;
  if v_linha.mes is null then
    raise exception 'O mês % não está fechado.', public.vales_formatar_mes(v_mes)
      using errcode = 'P0001';
  end if;

  insert into public.vales_historico (operacao, mes, antes, detalhe, usuario)
  values ('mes_reaberto', v_mes, to_jsonb(v_linha), btrim(p_motivo), public.email_usuario_atual());
end;
$$;

-- ------------------------------------------------------------
-- Row Level Security
-- Fechamento e histórico só mudam pelas funções acima (o app
-- consegue ler, mas não consegue editar nem apagar direto).
-- ------------------------------------------------------------
alter table public.vales_meses_fechados enable row level security;
alter table public.vales_historico enable row level security;

drop policy if exists "vales_meses_fechados_leitura" on public.vales_meses_fechados;
create policy "vales_meses_fechados_leitura" on public.vales_meses_fechados for select using (true);

drop policy if exists "vales_historico_leitura" on public.vales_historico;
create policy "vales_historico_leitura" on public.vales_historico for select using (true);

-- Atualiza o cache da API do Supabase com as colunas/funções novas.
notify pgrst, 'reload schema';

commit;
