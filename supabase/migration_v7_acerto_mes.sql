-- ============================================================
-- Migração v7: ACERTO DO MÊS por funcionário.
--
-- Total a descontar de cada funcionário = vales + consumo da loja
-- (o "Consumo loja mensal" anotado nos relatórios do dia).
--
-- Rode no SQL Editor do Supabase DEPOIS da v4 (segurança). É UM BLOCO
-- SÓ: aplica tudo ou nada. Pode rodar de novo sem problema.
--
-- O que faz:
--  - "Fechar acerto do mês" (pelo app) grava o total de cada pessoa e
--    trava aquele mês: os vales (fecha o mês dos vales junto) e o
--    consumo de funcionários nos relatórios não podem mais mudar.
--  - Só fecha se todo consumo estiver ligado a um funcionário do
--    cadastro (nada de nome digitado que não bate com ninguém).
--  - Reabrir exige motivo, reabre os vales junto e fica no histórico.
--  - Com o acerto fechado, o mês dos vales só reabre pelo acerto.
-- ============================================================

do $migracao$
begin
  if to_regclass('public.vales_meses_fechados') is null or to_regprocedure('public.fechar_mes_vales(date,text)') is null then
    raise exception 'Rode antes: migration_vales_v2.sql.';
  end if;
  if to_regprocedure('public.usuario_autorizado()') is null then
    raise exception 'Rode antes: migration_v4_seguranca.sql.';
  end if;

  create table if not exists public.acertos_mes (
    mes date primary key check (extract(day from mes) = 1),
    fechado_em timestamptz not null default now(),
    total numeric(12,2) not null,
    total_vales numeric(12,2) not null,
    total_consumo numeric(12,2) not null,
    -- [{ funcionario_id, funcionario, vales, qtd_vales, consumo, qtd_consumo, total }]
    resumo jsonb not null default '[]'::jsonb,
    observacao text,
    usuario text
  );

  -- Calcula o acerto de um mês (vales + consumo por funcionário).
  execute $f$
    create or replace function public.calcular_acerto_mes(p_mes date)
    returns jsonb
    language plpgsql
    stable
    security definer
    set search_path = public
    as $b$
    declare
      v_mes date := date_trunc('month', p_mes)::date;
      v_fim date := (date_trunc('month', p_mes) + interval '1 month')::date;
      v_resumo jsonb;
      v_sem jsonb;
    begin
      with consumo as (
        select r.id as relatorio_id, r.data, c.item,
               case when (c.item ->> 'valor') ~ '^-?[0-9]+(\.[0-9]+)?$'
                    then round((c.item ->> 'valor')::numeric, 2) else 0 end as valor,
               case when (c.item ->> 'funcionarioId') ~ '^[0-9a-fA-F-]{36}$'
                    then (c.item ->> 'funcionarioId')::uuid end as id_informado
        from public.relatorios r
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(r.consumo_loja_mensal) = 'array' then r.consumo_loja_mensal else '[]'::jsonb end
        ) as c(item)
        where r.data >= v_mes and r.data < v_fim
      ),
      ligado as (
        select c.*,
               coalesce(
                 (select f.id from public.funcionarios f where f.id = c.id_informado),
                 (select f.id from public.funcionarios f
                   where public.normalizar_nome(f.nome) = public.normalizar_nome(c.item ->> 'pessoa')
                   order by f.created_at, f.id limit 1)
               ) as funcionario_id
        from consumo c
        where c.valor > 0
      ),
      vales_mes as (
        select v.funcionario_id, sum(v.valor) as total, count(*) as qtd
        from public.vales v
        where v.excluido_em is null and v.data >= v_mes and v.data < v_fim and v.funcionario_id is not null
        group by v.funcionario_id
      ),
      consumo_mes as (
        select l.funcionario_id, sum(l.valor) as total, count(*) as qtd
        from ligado l where l.funcionario_id is not null
        group by l.funcionario_id
      ),
      linhas as (
        select f.id, f.nome,
               coalesce(vm.total, 0) as vales, coalesce(vm.qtd, 0) as qtd_vales,
               coalesce(cm.total, 0) as consumo, coalesce(cm.qtd, 0) as qtd_consumo
        from public.funcionarios f
        left join vales_mes vm on vm.funcionario_id = f.id
        left join consumo_mes cm on cm.funcionario_id = f.id
        where coalesce(vm.total, 0) + coalesce(cm.total, 0) > 0
      )
      select coalesce(jsonb_agg(jsonb_build_object(
               'funcionario_id', l.id, 'funcionario', l.nome,
               'vales', l.vales, 'qtd_vales', l.qtd_vales,
               'consumo', l.consumo, 'qtd_consumo', l.qtd_consumo,
               'total', l.vales + l.consumo
             ) order by public.normalizar_nome(l.nome)), '[]'::jsonb)
      into v_resumo
      from linhas l;

      select coalesce(jsonb_agg(jsonb_build_object(
               'relatorio_id', l.relatorio_id, 'data', l.data,
               'pessoa', l.item ->> 'pessoa', 'item', l.item ->> 'item', 'valor', l.valor
             ) order by l.data), '[]'::jsonb)
      into v_sem
      from (
        select c.*,
               coalesce(
                 (select f.id from public.funcionarios f where f.id = c.id_informado),
                 (select f.id from public.funcionarios f
                   where public.normalizar_nome(f.nome) = public.normalizar_nome(c.item ->> 'pessoa')
                   limit 1)
               ) as funcionario_id
        from (
          select r.id as relatorio_id, r.data, c.item,
                 case when (c.item ->> 'valor') ~ '^-?[0-9]+(\.[0-9]+)?$'
                      then round((c.item ->> 'valor')::numeric, 2) else 0 end as valor,
                 case when (c.item ->> 'funcionarioId') ~ '^[0-9a-fA-F-]{36}$'
                      then (c.item ->> 'funcionarioId')::uuid end as id_informado
          from public.relatorios r
          cross join lateral jsonb_array_elements(
            case when jsonb_typeof(r.consumo_loja_mensal) = 'array' then r.consumo_loja_mensal else '[]'::jsonb end
          ) as c(item)
          where r.data >= v_mes and r.data < v_fim
        ) c
        where c.valor > 0
      ) l
      where l.funcionario_id is null;

      return jsonb_build_object(
        'mes', v_mes,
        'resumo', v_resumo,
        'sem_funcionario', v_sem,
        'total_vales', (select coalesce(sum((x ->> 'vales')::numeric), 0) from jsonb_array_elements(v_resumo) x),
        'total_consumo', (select coalesce(sum((x ->> 'consumo')::numeric), 0) from jsonb_array_elements(v_resumo) x),
        'total', (select coalesce(sum((x ->> 'total')::numeric), 0) from jsonb_array_elements(v_resumo) x)
      );
    end;
    $b$
  $f$;

  execute $f$
    create or replace function public.fechar_acerto_mes(p_mes date, p_observacao text default null)
    returns jsonb
    language plpgsql
    security definer
    set search_path = public
    as $b$
    declare
      v_mes date := date_trunc('month', p_mes)::date;
      v_calc jsonb;
      v_linha public.acertos_mes;
    begin
      perform public.exigir_usuario_autorizado();
      if p_mes is null then
        raise exception 'Informe o mês.' using errcode = '22004';
      end if;
      if exists (select 1 from public.acertos_mes where mes = v_mes) then
        raise exception 'O acerto de % já está fechado.', to_char(v_mes, 'MM/YYYY')
          using errcode = 'P0001', hint = 'ACERTO_FECHADO';
      end if;

      -- Trava vales e relatórios do mês enquanto calcula.
      perform 1 from public.vales where data >= v_mes and data < (v_mes + interval '1 month') for update;
      perform 1 from public.relatorios where data >= v_mes and data < (v_mes + interval '1 month') for update;

      v_calc := public.calcular_acerto_mes(v_mes);
      if jsonb_array_length(v_calc -> 'sem_funcionario') > 0 then
        raise exception 'Há % consumo(s) sem funcionário identificado. Corrija na tela do acerto antes de fechar.',
          jsonb_array_length(v_calc -> 'sem_funcionario')
          using errcode = 'P0001', hint = 'CONSUMO_SEM_FUNCIONARIO';
      end if;

      -- Fecha o mês dos vales junto (se ainda estiver aberto).
      if not exists (select 1 from public.vales_meses_fechados where mes = v_mes) then
        perform public.fechar_mes_vales(v_mes, 'Fechado junto com o acerto do mês');
      end if;

      insert into public.acertos_mes (mes, total, total_vales, total_consumo, resumo, observacao, usuario)
      values (
        v_mes,
        (v_calc ->> 'total')::numeric,
        (v_calc ->> 'total_vales')::numeric,
        (v_calc ->> 'total_consumo')::numeric,
        v_calc -> 'resumo',
        nullif(btrim(coalesce(p_observacao, '')), ''),
        public.email_usuario_atual()
      )
      returning * into v_linha;

      insert into public.vales_historico (operacao, mes, depois, detalhe, usuario)
      values ('acerto_fechado', v_mes, to_jsonb(v_linha), v_linha.observacao, public.email_usuario_atual());

      return to_jsonb(v_linha);
    end;
    $b$
  $f$;

  execute $f$
    create or replace function public.reabrir_acerto_mes(p_mes date, p_motivo text)
    returns void
    language plpgsql
    security definer
    set search_path = public
    as $b$
    declare
      v_mes date := date_trunc('month', p_mes)::date;
      v_linha public.acertos_mes;
    begin
      perform public.exigir_usuario_autorizado();
      if length(btrim(coalesce(p_motivo, ''))) = 0 then
        raise exception 'Informe o motivo para reabrir o acerto.' using errcode = '23514';
      end if;
      delete from public.acertos_mes where mes = v_mes returning * into v_linha;
      if v_linha.mes is null then
        raise exception 'O acerto de % não está fechado.', to_char(v_mes, 'MM/YYYY') using errcode = 'P0001';
      end if;
      insert into public.vales_historico (operacao, mes, antes, detalhe, usuario)
      values ('acerto_reaberto', v_mes, to_jsonb(v_linha), btrim(p_motivo), public.email_usuario_atual());
      -- Reabre os vales junto, pra poder corrigir qualquer coisa do mês.
      if exists (select 1 from public.vales_meses_fechados where mes = v_mes) then
        perform public.reabrir_mes_vales(v_mes, 'Reaberto junto com o acerto: ' || btrim(p_motivo));
      end if;
    end;
    $b$
  $f$;

  -- Com o acerto fechado, o mês dos vales não reabre por fora.
  execute $f$
    create or replace function public.acerto_bloqueia_reabrir_vales()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $b$
    begin
      if exists (select 1 from public.acertos_mes where mes = old.mes) then
        raise exception 'O acerto de % está fechado. Para mexer nos vales, reabra o acerto do mês.', to_char(old.mes, 'MM/YYYY')
          using errcode = 'P0001', hint = 'ACERTO_FECHADO';
      end if;
      return old;
    end;
    $b$
  $f$;
  drop trigger if exists trg_vales_meses_fechados_acerto on public.vales_meses_fechados;
  create trigger trg_vales_meses_fechados_acerto
    before delete on public.vales_meses_fechados
    for each row execute function public.acerto_bloqueia_reabrir_vales();

  -- Com o acerto fechado, o consumo de funcionários do mês não muda.
  execute $f$
    create or replace function public.acerto_trava_consumo()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $b$
    declare
      v_tem_antes boolean := false;
      v_tem_depois boolean := false;
    begin
      if tg_op <> 'INSERT' then
        v_tem_antes := jsonb_typeof(old.consumo_loja_mensal) = 'array' and jsonb_array_length(old.consumo_loja_mensal) > 0;
      end if;
      if tg_op <> 'DELETE' then
        v_tem_depois := jsonb_typeof(new.consumo_loja_mensal) = 'array' and jsonb_array_length(new.consumo_loja_mensal) > 0;
      end if;

      if tg_op in ('UPDATE', 'DELETE') and v_tem_antes
         and exists (select 1 from public.acertos_mes where mes = date_trunc('month', old.data)::date)
         and (tg_op = 'DELETE'
              or new.consumo_loja_mensal is distinct from old.consumo_loja_mensal
              or date_trunc('month', new.data) <> date_trunc('month', old.data)) then
        raise exception 'O acerto de % está fechado: o consumo de funcionários desse mês não pode mudar. Reabra o acerto para corrigir.',
          to_char(old.data, 'MM/YYYY') using errcode = 'P0001', hint = 'ACERTO_FECHADO';
      end if;

      if tg_op in ('INSERT', 'UPDATE') and v_tem_depois
         and exists (select 1 from public.acertos_mes where mes = date_trunc('month', new.data)::date)
         and (tg_op = 'INSERT'
              or new.consumo_loja_mensal is distinct from old.consumo_loja_mensal
              or date_trunc('month', new.data) <> date_trunc('month', old.data)) then
        raise exception 'O acerto de % está fechado: não dá para lançar consumo de funcionários nesse mês. Reabra o acerto para corrigir.',
          to_char(new.data, 'MM/YYYY') using errcode = 'P0001', hint = 'ACERTO_FECHADO';
      end if;

      if tg_op = 'DELETE' then return old; end if;
      return new;
    end;
    $b$
  $f$;
  drop trigger if exists trg_relatorios_acerto on public.relatorios;
  create trigger trg_relatorios_acerto
    before insert or update or delete on public.relatorios
    for each row execute function public.acerto_trava_consumo();

  -- Acesso: só usuário autorizado lê; mudanças só pelas funções.
  alter table public.acertos_mes enable row level security;
  drop policy if exists "acertos_mes_autorizados" on public.acertos_mes;
  create policy "acertos_mes_autorizados" on public.acertos_mes
    for select to authenticated using (public.usuario_autorizado());
  revoke all on public.acertos_mes from anon;
  revoke insert, update, delete, truncate on public.acertos_mes from authenticated;
  grant select on public.acertos_mes to authenticated;

  revoke execute on function public.calcular_acerto_mes(date) from public, anon, authenticated;
  revoke execute on function public.fechar_acerto_mes(date, text) from public, anon;
  revoke execute on function public.reabrir_acerto_mes(date, text) from public, anon;
  grant execute on function public.fechar_acerto_mes(date, text) to authenticated;
  grant execute on function public.reabrir_acerto_mes(date, text) to authenticated;

  -- As cópias de segurança (v6) passam a incluir os acertos.
  if to_regprocedure('public.gerar_copia_seguranca(text)') is not null then
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
          'acertos_mes', coalesce((select jsonb_agg(to_jsonb(x) order by x.mes) from public.acertos_mes x), '[]'::jsonb),
          'funcionarios', coalesce((select jsonb_agg(to_jsonb(x) order by x.nome) from public.funcionarios x), '[]'::jsonb),
          'pratos', coalesce((select jsonb_agg(to_jsonb(x) order by x.nome) from public.pratos x), '[]'::jsonb)
        );

        v_qtd := '{}'::jsonb;
        foreach v_chave in array array['fechamentos', 'sangrias', 'relatorios', 'vales', 'vales_meses_fechados',
                                       'vales_historico', 'acertos_mes', 'funcionarios', 'pratos'] loop
          v_qtd := v_qtd || jsonb_build_object(v_chave, jsonb_array_length(v_dados -> v_chave));
        end loop;

        insert into public.copias_seguranca (origem, tamanho_bytes, quantidades, dados)
        values (coalesce(p_origem, 'automatica'), octet_length(v_dados::text), v_qtd, v_dados)
        returning id into v_id;

        delete from public.copias_seguranca
        where id not in (select c.id from public.copias_seguranca c order by c.criada_em desc limit 10);

        return jsonb_build_object('id', v_id, 'quantidades', v_qtd);
      end;
      $b$
    $f$;
    revoke execute on function public.gerar_copia_seguranca(text) from public, anon, authenticated;
  end if;

  perform pg_notify('pgrst', 'reload schema');
end
$migracao$;
