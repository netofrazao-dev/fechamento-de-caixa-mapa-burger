-- ============================================================
-- Migração v9: DIAS DE LOJA FECHADA (folga, feriado...).
--
-- Marca os dias em que a loja não abriu. Eles deixam de aparecer como
-- "dia sem fechamento" (tela Hoje, Histórico, resumos da semana e do
-- mês e PDFs).
--
-- Regras:
--  - não dá para marcar um dia que já tem fechamento de caixa salvo;
--  - se um fechamento for salvo num dia marcado, a marca sai sozinha;
--  - desmarcar é só apagar a marca (fica registrado na auditoria).
--
-- Rode no SQL Editor do Supabase DEPOIS da v8. É UM BLOCO SÓ: aplica
-- tudo ou nada. Pode rodar de novo sem problema.
-- ============================================================

do $migracao$
begin
  if to_regprocedure('public.usuario_autorizado()') is null then
    raise exception 'Rode antes: migration_v4_seguranca.sql.';
  end if;
  if to_regprocedure('public.registrar_auditoria()') is null then
    raise exception 'Rode antes: migration_v3_cadastros_integridade.sql.';
  end if;
  if to_regclass('public.produtos_estoque') is null then
    raise exception 'Rode antes: migration_v8_produtos_estoque.sql.';
  end if;

  create table if not exists public.dias_loja_fechada (
    id uuid primary key default gen_random_uuid(),
    data date not null unique,
    motivo text check (motivo is null or length(motivo) <= 200),
    marcado_em timestamptz not null default now(),
    usuario text default public.email_usuario_atual()
  );

  -- Não deixa marcar um dia que já tem fechamento de caixa.
  execute $f$
    create or replace function public.dia_loja_fechada_antes_gravar()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $b$
    begin
      if exists (select 1 from public.fechamentos where data = new.data) then
        raise exception 'O dia % já tem fechamento de caixa salvo; não dá para marcar como loja fechada.',
          to_char(new.data, 'DD/MM/YYYY') using errcode = 'P0001';
      end if;
      new.motivo := nullif(btrim(coalesce(new.motivo, '')), '');
      return new;
    end;
    $b$
  $f$;
  drop trigger if exists trg_dias_loja_fechada_antes on public.dias_loja_fechada;
  create trigger trg_dias_loja_fechada_antes before insert or update on public.dias_loja_fechada
    for each row execute function public.dia_loja_fechada_antes_gravar();

  -- Fechamento salvo num dia marcado como loja fechada: a marca sai sozinha.
  execute $f$
    create or replace function public.fechamento_desmarca_loja_fechada()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $b$
    begin
      delete from public.dias_loja_fechada where data = new.data;
      return null;
    end;
    $b$
  $f$;
  drop trigger if exists trg_fechamentos_desmarca_loja_fechada on public.fechamentos;
  create trigger trg_fechamentos_desmarca_loja_fechada after insert or update of data on public.fechamentos
    for each row execute function public.fechamento_desmarca_loja_fechada();

  -- Auditoria (quem marcou e quem desmarcou).
  drop trigger if exists trg_dias_loja_fechada_auditoria on public.dias_loja_fechada;
  create trigger trg_dias_loja_fechada_auditoria after insert or update or delete on public.dias_loja_fechada
    for each row execute function public.registrar_auditoria();

  -- Só usuário autorizado lê, marca e desmarca.
  alter table public.dias_loja_fechada enable row level security;
  drop policy if exists dias_loja_fechada_autorizados on public.dias_loja_fechada;
  create policy dias_loja_fechada_autorizados on public.dias_loja_fechada for all to authenticated
    using (public.usuario_autorizado()) with check (public.usuario_autorizado());
  revoke all on public.dias_loja_fechada from anon;
  grant select, insert, update, delete on public.dias_loja_fechada to authenticated;
  revoke execute on function public.dia_loja_fechada_antes_gravar() from public, anon, authenticated;
  revoke execute on function public.fechamento_desmarca_loja_fechada() from public, anon, authenticated;

  -- As cópias de segurança (v6) passam a incluir os dias de loja fechada.
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
          'pratos', coalesce((select jsonb_agg(to_jsonb(x) order by x.nome) from public.pratos x), '[]'::jsonb),
          'produtos_estoque', coalesce((select jsonb_agg(to_jsonb(x) order by x.ordem, x.nome) from public.produtos_estoque x), '[]'::jsonb),
          'dias_loja_fechada', coalesce((select jsonb_agg(to_jsonb(x) order by x.data) from public.dias_loja_fechada x), '[]'::jsonb)
        );

        v_qtd := '{}'::jsonb;
        foreach v_chave in array array['fechamentos', 'sangrias', 'relatorios', 'vales', 'vales_meses_fechados',
                                       'vales_historico', 'acertos_mes', 'funcionarios', 'pratos', 'produtos_estoque',
                                       'dias_loja_fechada'] loop
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
