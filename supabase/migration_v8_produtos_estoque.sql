-- ============================================================
-- Migração v8: PRODUTOS DO ESTOQUE (refrigerantes e bebidas).
--
-- Antes a lista de bebidas contadas no "Estoque quente" do relatório
-- era fixa no sistema. Agora ela fica no banco e dá para:
--  - adicionar um produto novo que chegou;
--  - desativar o que parou de vender (some do relatório, mas os
--    relatórios antigos continuam mostrando a contagem dele);
--  - reativar quando voltar; renomear.
-- Tudo em Cadastros > Produtos do estoque.
--
-- Rode no SQL Editor do Supabase DEPOIS da v7. É UM BLOCO SÓ: aplica
-- tudo ou nada. Pode rodar de novo sem problema (não duplica nada).
-- ============================================================

do $migracao$
begin
  if to_regprocedure('public.usuario_autorizado()') is null then
    raise exception 'Rode antes: migration_v4_seguranca.sql.';
  end if;
  if to_regprocedure('public.registrar_auditoria()') is null or to_regprocedure('public.normalizar_nome(text)') is null then
    raise exception 'Rode antes: migration_v3_cadastros_integridade.sql.';
  end if;
  if to_regclass('public.acertos_mes') is null then
    raise exception 'Rode antes: migration_v7_acerto_mes.sql.';
  end if;

  create table if not exists public.produtos_estoque (
    id uuid primary key default gen_random_uuid(),
    nome text not null check (length(btrim(nome)) > 0 and length(nome) <= 80),
    ativo boolean not null default true,
    ordem integer not null default 0,
    created_at timestamptz not null default now()
  );
  create unique index if not exists produtos_estoque_nome_normalizado_uk
    on public.produtos_estoque (public.normalizar_nome(nome));

  -- Começa com a mesma lista que o sistema usava (só se a tabela estiver vazia).
  if not exists (select 1 from public.produtos_estoque) then
    insert into public.produtos_estoque (nome, ordem)
    select nome, ordem
    from unnest(array[
      'Coca KS', 'Mini energético', 'Coca Normal 350ml', 'Coca Zero 350ml', 'Fanta Laranja 350ml',
      'Tuchaua 350ml', 'Fanta Uva 350ml', 'Sprite 350ml', 'Água C/G 500ml', 'Água S/G 330ml',
      'Guaraná 1L', 'Coca 1L', 'Monster branco', 'Coca Zero 1L', 'Monster Azul'
    ]) with ordinality as p(nome, ordem);
  end if;

  -- Produto novo vai para o fim da lista.
  execute $f$
    create or replace function public.produto_estoque_ordem()
    returns trigger
    language plpgsql
    as $b$
    begin
      new.nome := regexp_replace(btrim(new.nome), '\s+', ' ', 'g');
      if tg_op = 'INSERT' and coalesce(new.ordem, 0) = 0 then
        new.ordem := coalesce((select max(ordem) from public.produtos_estoque), 0) + 1;
      end if;
      return new;
    end;
    $b$
  $f$;
  drop trigger if exists trg_produtos_estoque_ordem on public.produtos_estoque;
  create trigger trg_produtos_estoque_ordem before insert or update on public.produtos_estoque
    for each row execute function public.produto_estoque_ordem();

  -- Auditoria (quem criou, renomeou, desativou).
  drop trigger if exists trg_produtos_estoque_auditoria on public.produtos_estoque;
  create trigger trg_produtos_estoque_auditoria after insert or update or delete on public.produtos_estoque
    for each row execute function public.registrar_auditoria();

  -- Só usuário autorizado lê e altera. Apagar não: desativa.
  alter table public.produtos_estoque enable row level security;
  drop policy if exists produtos_estoque_autorizados on public.produtos_estoque;
  create policy produtos_estoque_autorizados on public.produtos_estoque for all to authenticated
    using (public.usuario_autorizado()) with check (public.usuario_autorizado());
  revoke all on public.produtos_estoque from anon;
  revoke delete, truncate on public.produtos_estoque from authenticated;
  grant select, insert, update on public.produtos_estoque to authenticated;

  -- As cópias de segurança (v6) passam a incluir os produtos do estoque.
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
          'produtos_estoque', coalesce((select jsonb_agg(to_jsonb(x) order by x.ordem, x.nome) from public.produtos_estoque x), '[]'::jsonb)
        );

        v_qtd := '{}'::jsonb;
        foreach v_chave in array array['fechamentos', 'sangrias', 'relatorios', 'vales', 'vales_meses_fechados',
                                       'vales_historico', 'acertos_mes', 'funcionarios', 'pratos', 'produtos_estoque'] loop
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
