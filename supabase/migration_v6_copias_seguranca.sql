-- ============================================================
-- Migração v6: CÓPIAS DE SEGURANÇA automáticas.
--
-- Rode no SQL Editor do Supabase DEPOIS da v4 (segurança) e da v5
-- (manter ativo). É UM BLOCO SÓ: aplica tudo ou nada. Pode rodar
-- de novo sem problema. Não altera nenhum dado do sistema.
--
-- O que faz:
--  - A cada verificação automática (de 3 em 3 dias, pela Vercel), o
--    banco guarda uma cópia completa dos dados: fechamentos, sangrias,
--    relatórios (sem os prints), vales, meses fechados, histórico dos
--    vales, funcionários e pratos.
--  - Ficam guardadas as 10 cópias mais recentes (~30 dias).
--  - Na tela "Cadastros e conta" do app dá pra baixar qualquer uma.
--  - Protege contra exclusão ou alteração por engano. Para proteger
--    contra perder a conta, baixe uma cópia no celular/computador de
--    vez em quando (botão "Baixar cópia completa agora").
-- ============================================================

do $migracao$
begin
  if to_regprocedure('public.manter_ativo()') is null then
    raise exception 'Rode antes: migration_v5_manter_ativo.sql.';
  end if;
  if to_regprocedure('public.usuario_autorizado()') is null then
    raise exception 'Rode antes: migration_v4_seguranca.sql.';
  end if;

  create table if not exists public.copias_seguranca (
    id bigint generated always as identity primary key,
    criada_em timestamptz not null default now(),
    origem text not null default 'automatica',
    tamanho_bytes integer not null,
    quantidades jsonb not null,
    dados jsonb not null
  );
  create index if not exists idx_copias_seguranca_data on public.copias_seguranca (criada_em desc);

  -- Gera uma cópia completa (só o próprio banco chama).
  execute $f$
    create or replace function public.gerar_copia_seguranca(p_origem text default 'automatica')
    returns jsonb
    language plpgsql
    security definer
    set search_path = public
    as $b$
    declare
      v_dados jsonb;
      v_qtd jsonb;
      v_id bigint;
      v_chave text;
    begin
      v_dados := jsonb_build_object(
        'sistema', 'Mapa Burger - fechamento de caixa',
        'versao', 1,
        'gerada_em', now(),
        'fechamentos', coalesce((select jsonb_agg(to_jsonb(x) order by x.data, x.turno) from public.fechamentos x), '[]'::jsonb),
        'sangrias', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.sangrias x), '[]'::jsonb),
        'relatorios', coalesce((select jsonb_agg(to_jsonb(x) - 'imagem1' - 'imagem2' order by x.data) from public.relatorios x), '[]'::jsonb),
        'vales', coalesce((select jsonb_agg(to_jsonb(x) order by x.data, x.created_at) from public.vales x), '[]'::jsonb),
        'vales_meses_fechados', coalesce((select jsonb_agg(to_jsonb(x) order by x.mes) from public.vales_meses_fechados x), '[]'::jsonb),
        'vales_historico', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.vales_historico x), '[]'::jsonb),
        'funcionarios', coalesce((select jsonb_agg(to_jsonb(x) order by x.nome) from public.funcionarios x), '[]'::jsonb),
        'pratos', coalesce((select jsonb_agg(to_jsonb(x) order by x.nome) from public.pratos x), '[]'::jsonb)
      );

      v_qtd := '{}'::jsonb;
      foreach v_chave in array array['fechamentos', 'sangrias', 'relatorios', 'vales', 'vales_meses_fechados',
                                     'vales_historico', 'funcionarios', 'pratos'] loop
        v_qtd := v_qtd || jsonb_build_object(v_chave, jsonb_array_length(v_dados -> v_chave));
      end loop;

      insert into public.copias_seguranca (origem, tamanho_bytes, quantidades, dados)
      values (coalesce(p_origem, 'automatica'), octet_length(v_dados::text), v_qtd, v_dados)
      returning id into v_id;

      -- Guarda só as 10 mais recentes.
      delete from public.copias_seguranca
      where id not in (select c.id from public.copias_seguranca c order by c.criada_em desc limit 10);

      return jsonb_build_object('id', v_id, 'quantidades', v_qtd);
    end;
    $b$
  $f$;

  -- A verificação automática (v5) passa a gerar a cópia, no máximo uma a cada 2 dias.
  execute $f$
    create or replace function public.manter_ativo()
    returns jsonb
    language plpgsql
    security definer
    set search_path = public
    as $b$
    declare
      t text;
      v_faltando text[] := '{}';
      v_resultado jsonb;
      v_copia jsonb := null;
    begin
      foreach t in array array['fechamentos', 'sangrias', 'relatorios', 'funcionarios', 'pratos', 'vales', 'rascunhos'] loop
        if to_regclass('public.' || t) is null then
          v_faltando := v_faltando || t;
        else
          execute format('select 1 from public.%I limit 1', t);
        end if;
      end loop;

      if cardinality(v_faltando) = 0 and not exists (
        select 1 from public.copias_seguranca where criada_em > now() - interval '2 days'
      ) then
        v_copia := public.gerar_copia_seguranca('automatica');
      end if;

      v_resultado := jsonb_build_object(
        'ok', cardinality(v_faltando) = 0,
        'verificado_em', now(),
        'tabelas_faltando', to_jsonb(v_faltando),
        'copia_gerada', v_copia is not null
      );

      insert into public.sistema_verificacoes (id, ultima_em, vezes, ultimo_resultado)
      values (1, now(), 1, v_resultado)
      on conflict (id) do update
        set ultima_em = now(),
            vezes = public.sistema_verificacoes.vezes + 1,
            ultimo_resultado = excluded.ultimo_resultado;

      return v_resultado;
    end;
    $b$
  $f$;

  -- Acesso: só usuário autorizado lê as cópias; ninguém altera pelo app.
  alter table public.copias_seguranca enable row level security;
  drop policy if exists "copias_seguranca_autorizados" on public.copias_seguranca;
  create policy "copias_seguranca_autorizados" on public.copias_seguranca
    for select to authenticated using (public.usuario_autorizado());
  revoke all on public.copias_seguranca from anon;
  revoke insert, update, delete, truncate on public.copias_seguranca from authenticated;
  grant select on public.copias_seguranca to authenticated;

  revoke execute on function public.gerar_copia_seguranca(text) from public, anon, authenticated;
  revoke execute on function public.manter_ativo() from public;
  grant execute on function public.manter_ativo() to anon, authenticated;

  -- Já deixa uma primeira cópia pronta.
  if not exists (select 1 from public.copias_seguranca) then
    perform public.gerar_copia_seguranca('automatica');
  end if;

  perform pg_notify('pgrst', 'reload schema');
end
$migracao$;
