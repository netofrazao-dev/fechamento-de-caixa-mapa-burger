-- ============================================================
-- Migração v10: MARMITAS NO RELATÓRIO e SUPRIMENTO NO FECHAMENTO.
--
--  - Relatório do dia ganha a contagem de marmitas por prato (coluna
--    "marmitas"). Os fechamentos antigos continuam com a contagem que
--    já tinham; os resumos usam a do relatório quando ela existe.
--  - Fechamento ganha o SUPRIMENTO (dinheiro colocado no caixa durante
--    o dia). É só informativo, como a abertura: não entra em conta
--    nenhuma. Com suprimento, a observação é obrigatória.
--
-- Rode no SQL Editor do Supabase DEPOIS da v9. É UM BLOCO SÓ: aplica
-- tudo ou nada. Pode rodar de novo sem problema.
-- ============================================================

do $migracao$
begin
  if to_regclass('public.dias_loja_fechada') is null then
    raise exception 'Rode antes: migration_v9_loja_fechada.sql.';
  end if;

  -- Marmitas vendidas por prato, contadas no relatório do dia.
  alter table public.relatorios add column if not exists marmitas jsonb not null default '[]'::jsonb;
  if not exists (select 1 from pg_constraint where conname = 'relatorios_marmitas_lista') then
    alter table public.relatorios
      add constraint relatorios_marmitas_lista check (jsonb_typeof(marmitas) = 'array');
  end if;

  -- Suprimento: dinheiro colocado no caixa durante o dia (só informativo).
  alter table public.fechamentos add column if not exists suprimento numeric(12,2) not null default 0;
  alter table public.fechamentos add column if not exists suprimento_obs text;
  if not exists (select 1 from pg_constraint where conname = 'fechamentos_suprimento_valido') then
    alter table public.fechamentos
      add constraint fechamentos_suprimento_valido check (
        suprimento >= 0
        and (suprimento_obs is null or length(suprimento_obs) <= 300)
        and (suprimento = 0 or length(btrim(coalesce(suprimento_obs, ''))) > 0)
      );
  end if;

  perform pg_notify('pgrst', 'reload schema');
end
$migracao$;
