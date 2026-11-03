-- ============================================================
-- Migração v4: SEGURANÇA — só entra quem tem login autorizado.
--
-- ATENÇÃO À ORDEM (senão o sistema fica fora do ar):
--   1. Supabase → Authentication → Users → "Add user": crie o login
--      (e-mail + senha) de cada pessoa que usa o sistema, marcando
--      "Auto Confirm User".
--   2. Supabase → Authentication → Sign In / Providers: DESLIGUE
--      "Allow new users to sign up" (ninguém se cadastra sozinho).
--   3. Publique a versão do app que tem a tela de login e confira
--      que você consegue entrar.
--   4. Só então rode este arquivo, depois de trocar o e-mail abaixo.
--
-- É UM BLOCO SÓ: o SQL Editor do Supabase aplica tudo ou nada (se der
-- erro no meio, nada muda). Pode rodar de novo sem problema, por exemplo
-- para incluir mais alguém na lista.
--
-- Depois disso, a chave pública (anon) que fica dentro do app não
-- abre mais nada: sem login autorizado, o banco não mostra nem
-- aceita nenhum dado.
-- ============================================================

do $migracao$
declare
  -- >>> EDITE AQUI: e-mails de login autorizados, separados por vírgula <<<
  v_emails text[] := array['COLOQUE_SEU_EMAIL_AQUI'];
  -- Para tirar o acesso de alguém depois:
  --   update public.usuarios_autorizados set ativo = false where email = '...';
  t text;
begin
  if to_regclass('public.auditoria') is null or to_regclass('public.vales_historico') is null then
    raise exception 'Rode antes: migration_vales_v2.sql e migration_v3_cadastros_integridade.sql.';
  end if;
  if exists (select 1 from unnest(v_emails) e where e ilike 'coloque_seu_email%') then
    raise exception 'Troque COLOQUE_SEU_EMAIL_AQUI pelo seu e-mail de login antes de rodar.';
  end if;
  if exists (select 1 from unnest(v_emails) e where btrim(e) not like '%_@_%') then
    raise exception 'Algum e-mail da lista está escrito errado (sem @).';
  end if;

  -- Quem pode usar o sistema
  create table if not exists public.usuarios_autorizados (
    email text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
    nome text,
    ativo boolean not null default true,
    criado_em timestamptz not null default now()
  );

  insert into public.usuarios_autorizados (email)
  select distinct lower(btrim(e)) from unnest(v_emails) e
  on conflict (email) do update set ativo = true;

  if not exists (select 1 from public.usuarios_autorizados where ativo) then
    raise exception 'A lista de usuários autorizados está vazia: ninguém conseguiria entrar.';
  end if;

  -- Verificação de permissão
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
        where u.ativo and u.email = public.email_usuario_atual()
      )
    $b$
  $f$;

  execute $f$
    create or replace function public.exigir_usuario_autorizado()
    returns void
    language plpgsql
    stable
    security definer
    set search_path = public
    as $b$
    begin
      if not public.usuario_autorizado() then
        raise exception 'Acesso negado: entre com um usuário autorizado.' using errcode = '42501';
      end if;
    end;
    $b$
  $f$;

  -- Tabelas que o app lê e grava: só usuário autorizado
  foreach t in array array['fechamentos', 'sangrias', 'relatorios', 'funcionarios', 'pratos', 'vales', 'rascunhos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all_access', t);
    execute format('drop policy if exists %I on public.%I', t || '_autorizados', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.usuario_autorizado()) with check (public.usuario_autorizado())',
      t || '_autorizados', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;

  -- Tabelas só de leitura pelo app (escritas pelo próprio banco)
  foreach t in array array['vales_meses_fechados', 'vales_historico', 'auditoria'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format('drop policy if exists %I on public.%I', t || '_autorizados', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.usuario_autorizado())',
      t || '_autorizados', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;

  -- Lista de autorizados: cada um só vê a própria linha; ninguém altera pelo app
  alter table public.usuarios_autorizados enable row level security;
  drop policy if exists "usuarios_autorizados_propria_linha" on public.usuarios_autorizados;
  create policy "usuarios_autorizados_propria_linha" on public.usuarios_autorizados
    for select to authenticated using (email = public.email_usuario_atual());
  revoke all on public.usuarios_autorizados from anon;
  revoke insert, update, delete, truncate on public.usuarios_autorizados from authenticated;
  grant select on public.usuarios_autorizados to authenticated;

  -- Funções chamadas pelo app: só para quem está logado
  revoke execute on function public.fechar_mes_vales(date, text) from public, anon;
  revoke execute on function public.reabrir_mes_vales(date, text) from public, anon;
  revoke execute on function public.usuario_autorizado() from public, anon;
  revoke execute on function public.exigir_usuario_autorizado() from public, anon;
  grant execute on function public.fechar_mes_vales(date, text) to authenticated;
  grant execute on function public.reabrir_mes_vales(date, text) to authenticated;
  grant execute on function public.usuario_autorizado() to authenticated;
  grant execute on function public.exigir_usuario_autorizado() to authenticated;

  perform pg_notify('pgrst', 'reload schema');
end
$migracao$;
