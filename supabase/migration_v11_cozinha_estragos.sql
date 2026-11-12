-- ============================================================
-- Migração v11: LOGIN DA COZINHA — lançar o que estragou.
--
-- Cria um tipo de acesso "cozinha": a pessoa entra no sistema (pode
-- instalar no celular como aplicativo) e só vê uma tela para lançar o
-- que estragou no dia. Ela NÃO vê caixa, relatórios, vales nem nada mais
-- (o banco bloqueia). O que ela lança aparece sozinho na parte
-- "Estragou" do relatório do dia.
--
-- Quem já está na lista continua com acesso total (papel "dono").
-- Para dar acesso de cozinha a alguém (depois de criar o login dela em
-- Authentication → Users → Add user):
--   insert into public.usuarios_autorizados (email, nome, papel)
--   values ('email-da-pessoa@exemplo.com', 'Nome', 'cozinha');
--
-- Rode no SQL Editor do Supabase DEPOIS da v10. É UM BLOCO SÓ: aplica
-- tudo ou nada. Pode rodar de novo sem problema.
-- ============================================================

do $migracao$
begin
  if to_regprocedure('public.usuario_autorizado()') is null then
    raise exception 'Rode antes: migration_v4_seguranca.sql.';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'fechamentos' and column_name = 'suprimento') then
    raise exception 'Rode antes: migration_v10_marmitas_suprimento.sql.';
  end if;

  -- Papel de cada pessoa da lista: dono (acesso total) ou cozinha (só lança estragos).
  alter table public.usuarios_autorizados add column if not exists papel text not null default 'dono';
  if not exists (select 1 from pg_constraint where conname = 'usuarios_autorizados_papel_valido') then
    alter table public.usuarios_autorizados
      add constraint usuarios_autorizados_papel_valido check (papel in ('dono', 'cozinha'));
  end if;

  -- Acesso total: só quem é "dono" (a cozinha fica de fora de todas as tabelas do sistema).
  execute $f$
    create or replace function public.usuario_autorizado()
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
    as $b$
      select coalesce(
        (nullif(nullif(current_setting('request.jwt.claims', true), ''), 'null')::jsonb ->> 'role') = 'authenticated',
        false
      )
      and exists (
        select 1 from public.usuarios_autorizados u
        where u.ativo and u.papel = 'dono' and u.email = public.email_usuario_atual()
      )
    $b$
  $f$;

  -- Papel de quem está logado (o app usa para saber qual tela mostrar).
  execute $f$
    create or replace function public.papel_usuario()
    returns text
    language sql
    stable
    security definer
    set search_path = public
    as $b$
      select u.papel from public.usuarios_autorizados u
      where coalesce(
          (nullif(nullif(current_setting('request.jwt.claims', true), ''), 'null')::jsonb ->> 'role') = 'authenticated',
          false
        )
        and u.ativo and u.email = public.email_usuario_atual()
    $b$
  $f$;

  execute $f$
    create or replace function public.usuario_cozinha()
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
    as $b$
      select coalesce(public.papel_usuario() = 'cozinha', false)
    $b$
  $f$;
  revoke execute on function public.papel_usuario() from public, anon;
  revoke execute on function public.usuario_cozinha() from public, anon;
  grant execute on function public.papel_usuario(), public.usuario_cozinha() to authenticated;

  -- O que a cozinha lança como estragado (entra no relatório do dia).
  create table if not exists public.estragos_cozinha (
    id uuid primary key default gen_random_uuid(),
    data date not null,
    texto text not null check (length(btrim(texto)) between 1 and 200),
    criado_em timestamptz not null default now(),
    usuario text,
    nome text,
    -- Quando já entrou no relatório do dia (aí a cozinha não apaga mais).
    importado_em timestamptz
  );
  create index if not exists idx_estragos_cozinha_data on public.estragos_cozinha (data);

  -- Quem lançou vem do login (não dá para lançar em nome de outra pessoa).
  execute $f$
    create or replace function public.estrago_antes_gravar()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $b$
    begin
      if tg_op = 'INSERT' then
        new.usuario := coalesce(public.email_usuario_atual(), new.usuario);
        new.nome := (select u.nome from public.usuarios_autorizados u where u.email = new.usuario);
        new.texto := btrim(regexp_replace(new.texto, '\s+', ' ', 'g'));
        if not public.usuario_autorizado() then
          new.importado_em := null;
          new.criado_em := now();
        end if;
      end if;
      return new;
    end;
    $b$
  $f$;
  drop trigger if exists trg_estragos_cozinha_antes on public.estragos_cozinha;
  create trigger trg_estragos_cozinha_antes before insert on public.estragos_cozinha
    for each row execute function public.estrago_antes_gravar();
  revoke execute on function public.estrago_antes_gravar() from public, anon, authenticated;

  drop trigger if exists trg_estragos_cozinha_auditoria on public.estragos_cozinha;
  create trigger trg_estragos_cozinha_auditoria after insert or update or delete on public.estragos_cozinha
    for each row execute function public.registrar_auditoria();

  alter table public.estragos_cozinha enable row level security;
  -- Dono: tudo.
  drop policy if exists estragos_cozinha_dono on public.estragos_cozinha;
  create policy estragos_cozinha_dono on public.estragos_cozinha for all to authenticated
    using (public.usuario_autorizado()) with check (public.usuario_autorizado());
  -- Cozinha: vê e lança só os próprios, dos últimos dias; apaga só o que ainda não entrou no relatório.
  drop policy if exists estragos_cozinha_ver on public.estragos_cozinha;
  create policy estragos_cozinha_ver on public.estragos_cozinha for select to authenticated
    using (public.usuario_cozinha() and usuario = public.email_usuario_atual() and data >= current_date - 2);
  drop policy if exists estragos_cozinha_lancar on public.estragos_cozinha;
  create policy estragos_cozinha_lancar on public.estragos_cozinha for insert to authenticated
    with check (
      public.usuario_cozinha() and usuario = public.email_usuario_atual() and importado_em is null
      and data between current_date - 1 and current_date + 1
    );
  drop policy if exists estragos_cozinha_apagar on public.estragos_cozinha;
  create policy estragos_cozinha_apagar on public.estragos_cozinha for delete to authenticated
    using (public.usuario_cozinha() and usuario = public.email_usuario_atual() and importado_em is null);
  revoke all on public.estragos_cozinha from anon;
  grant select, insert, update, delete on public.estragos_cozinha to authenticated;

  perform pg_notify('pgrst', 'reload schema');
end
$migracao$;
