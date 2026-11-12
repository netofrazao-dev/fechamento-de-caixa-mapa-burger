-- ============================================================
-- Migração v12: REMOVE O LOGIN DA COZINHA (a ideia foi descontinuada).
--
-- Desfaz o que a v11 criou: a tabela de estragos lançados pela cozinha,
-- o papel "cozinha" na lista de acesso e as funções dele (quem estava
-- cadastrado como "cozinha" sai da lista). A verificação de acesso volta
-- a ser a de antes (todo mundo da lista tem acesso total).
--
-- Rode no SQL Editor do Supabase. É UM BLOCO SÓ: aplica tudo ou nada.
-- Pode rodar mesmo em banco que nunca teve a v11, e pode rodar de novo.
-- ============================================================

do $migracao$
begin
  if to_regprocedure('public.usuario_autorizado()') is null then
    raise exception 'Rode antes: migration_v4_seguranca.sql.';
  end if;

  -- Acesso volta a ser só "estar na lista e ativo" (como na v4).
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

  -- Estragos lançados pela cozinha (e os gatilhos e regras dela).
  drop table if exists public.estragos_cozinha;
  drop function if exists public.estrago_antes_gravar();
  drop function if exists public.usuario_cozinha();
  drop function if exists public.papel_usuario();

  -- Quem estava cadastrado como "cozinha" sai da lista (senão ganharia acesso total sem o papel).
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'usuarios_autorizados' and column_name = 'papel') then
    execute 'delete from public.usuarios_autorizados where papel = ''cozinha''';
  end if;

  -- Papel na lista de acesso.
  alter table public.usuarios_autorizados drop constraint if exists usuarios_autorizados_papel_valido;
  alter table public.usuarios_autorizados drop column if exists papel;

  perform pg_notify('pgrst', 'reload schema');
end
$migracao$;
