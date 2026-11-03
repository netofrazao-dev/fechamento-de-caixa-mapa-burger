-- ============================================================
-- Migração v5: verificação automática ("manter ativo").
--
-- O Supabase grátis pausa o banco depois de 7 dias sem uso.
-- A Vercel chama a função abaixo de 3 em 3 dias (vercel.json →
-- crons → /api/manter-ativo). Ela confere se as tabelas do sistema
-- existem e respondem, e registra a verificação — isso conta como
-- uso do banco, então ele não é pausado.
--
-- Pode rodar a qualquer momento (antes ou depois da v4) e mais de
-- uma vez. Não mexe em nenhum dado do sistema.
-- ============================================================

begin;

-- Uma linha só, com a data da última verificação.
create table if not exists public.sistema_verificacoes (
  id integer primary key default 1 check (id = 1),
  ultima_em timestamptz not null default now(),
  vezes bigint not null default 0,
  ultimo_resultado jsonb
);

-- Ninguém lê nem altera essa tabela pelo app; só a função abaixo.
alter table public.sistema_verificacoes enable row level security;
revoke all on public.sistema_verificacoes from anon, authenticated;

create or replace function public.manter_ativo()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  v_faltando text[] := '{}';
  v_resultado jsonb;
begin
  -- Confere se cada tabela do sistema existe e responde a uma leitura.
  foreach t in array array['fechamentos', 'sangrias', 'relatorios', 'funcionarios', 'pratos', 'vales', 'rascunhos'] loop
    if to_regclass('public.' || t) is null then
      v_faltando := v_faltando || t;
    else
      execute format('select 1 from public.%I limit 1', t);
    end if;
  end loop;

  v_resultado := jsonb_build_object(
    'ok', cardinality(v_faltando) = 0,
    'verificado_em', now(),
    'tabelas_faltando', to_jsonb(v_faltando)
  );

  -- Grava a verificação (uma escrita de verdade no banco).
  insert into public.sistema_verificacoes (id, ultima_em, vezes, ultimo_resultado)
  values (1, now(), 1, v_resultado)
  on conflict (id) do update
    set ultima_em = now(),
        vezes = public.sistema_verificacoes.vezes + 1,
        ultimo_resultado = excluded.ultimo_resultado;

  -- Responde só "ok" e a hora: nenhum dado do sistema sai daqui.
  return v_resultado;
end;
$$;

-- A Vercel chama com a chave pública (anon), sem login.
revoke execute on function public.manter_ativo() from public;
grant execute on function public.manter_ativo() to anon, authenticated;

notify pgrst, 'reload schema';

commit;
