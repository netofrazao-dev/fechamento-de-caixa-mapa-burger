-- ============================================================
-- Migração v3: cadastros, integridade dos números e auditoria.
--
-- Rode no SQL Editor do Supabase DEPOIS de migration_vales_v2.sql.
-- Pode rodar mais de uma vez. Não apaga nem altera dados existentes
-- (as regras novas valem para o que for gravado daqui pra frente).
--
-- O que muda:
--  1. Funcionários e pratos podem ser desativados (somem da lista de
--     seleção, mas o histórico continua intacto).
--  2. O banco confere as contas de cada fechamento: se o total, a
--     diferença ou a situação (fechou/sobrou/faltou) não baterem com
--     os valores digitados, ele recusa. Valores negativos também.
--  3. Auditoria: toda criação, alteração e exclusão de fechamento,
--     sangria, relatório, funcionário e prato fica registrada (com o
--     conteúdo de antes e depois e quem fez, quando houver login).
--  4. Um relatório por data (se ainda não houver datas repetidas).
-- ============================================================

begin;

do $$
begin
  if to_regprocedure('public.normalizar_nome(text)') is null
     or to_regprocedure('public.email_usuario_atual()') is null then
    raise exception 'Rode primeiro o arquivo migration_vales_v2.sql.';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 1. Cadastros: ativo/inativo
-- ------------------------------------------------------------
alter table public.funcionarios add column if not exists ativo boolean not null default true;
alter table public.pratos add column if not exists ativo boolean not null default true;

alter table public.pratos drop constraint if exists pratos_nome_nao_vazio;
alter table public.pratos add constraint pratos_nome_nao_vazio check (length(btrim(nome)) > 0) not valid;

do $$
begin
  if not exists (
    select 1 from public.pratos group by public.normalizar_nome(nome) having count(*) > 1
  ) then
    create unique index if not exists pratos_nome_normalizado_uk on public.pratos (public.normalizar_nome(nome));
  else
    raise notice 'Há pratos com nomes repetidos (ignorando acento/maiúscula); trava de duplicados não ativada.';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 2. Fechamentos: as contas precisam bater
-- (mesmas regras de src/lib/calculations.ts)
-- ------------------------------------------------------------
alter table public.fechamentos add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_fechamentos_updated_at on public.fechamentos;
create trigger trg_fechamentos_updated_at
  before update on public.fechamentos
  for each row execute function public.set_updated_at();

alter table public.fechamentos drop constraint if exists fechamentos_valores_nao_negativos;
alter table public.fechamentos add constraint fechamentos_valores_nao_negativos check (
  dinheiro_abertura >= 0 and dinheiro_fechamento >= 0 and pix_lc >= 0 and debito_lc >= 0
  and credito_lc >= 0 and consumo_loja >= 0 and a_prazo >= 0 and ticket >= 0
  and pix_brendi >= 0 and debito_brendi >= 0 and credito_brendi >= 0
  and credito_online_brendi >= 0 and dinheiro_brendi >= 0
  and total_lc_sistema >= 0 and ajuste_valor >= 0
) not valid;

alter table public.fechamentos drop constraint if exists fechamentos_total_lc_confere;
alter table public.fechamentos add constraint fechamentos_total_lc_confere check (
  total_lc = dinheiro_fechamento + pix_lc + debito_lc + credito_lc + consumo_loja + a_prazo + ticket
) not valid;

alter table public.fechamentos drop constraint if exists fechamentos_total_brendi_confere;
alter table public.fechamentos add constraint fechamentos_total_brendi_confere check (
  total_brendi = pix_brendi + debito_brendi + credito_brendi + credito_online_brendi
) not valid;

alter table public.fechamentos drop constraint if exists fechamentos_total_caixa_confere;
alter table public.fechamentos add constraint fechamentos_total_caixa_confere check (
  total_caixa = total_lc + total_brendi
) not valid;

alter table public.fechamentos drop constraint if exists fechamentos_total_sistema_confere;
alter table public.fechamentos add constraint fechamentos_total_sistema_confere check (
  total_sistema = total_lc_sistema + total_brendi + dinheiro_brendi
) not valid;

alter table public.fechamentos drop constraint if exists fechamentos_diferenca_confere;
alter table public.fechamentos add constraint fechamentos_diferenca_confere check (
  diferenca_original = total_caixa - total_sistema
) not valid;

alter table public.fechamentos drop constraint if exists fechamentos_ajuste_confere;
alter table public.fechamentos add constraint fechamentos_ajuste_confere check (
  ajuste_aplicado = case ajuste_tipo
    when 'adicionar' then abs(ajuste_valor)
    when 'remover' then -abs(ajuste_valor)
    else 0
  end
) not valid;

alter table public.fechamentos drop constraint if exists fechamentos_diferenca_final_confere;
alter table public.fechamentos add constraint fechamentos_diferenca_final_confere check (
  diferenca_final = diferenca_original + ajuste_aplicado
) not valid;

alter table public.fechamentos drop constraint if exists fechamentos_status_confere;
alter table public.fechamentos add constraint fechamentos_status_confere check (
  status = case when diferenca_final = 0 then 'fechou' when diferenca_final > 0 then 'sobrou' else 'faltou' end
) not valid;

alter table public.fechamentos drop constraint if exists fechamentos_ajuste_com_observacao;
alter table public.fechamentos add constraint fechamentos_ajuste_com_observacao check (
  ajuste_tipo is null or ajuste_valor = 0 or length(btrim(coalesce(observacoes, ''))) > 0
) not valid;

alter table public.fechamentos drop constraint if exists fechamentos_observacoes_tamanho;
alter table public.fechamentos add constraint fechamentos_observacoes_tamanho check (
  observacoes is null or length(observacoes) <= 2000
) not valid;

-- ------------------------------------------------------------
-- Relatórios: valores coerentes, imagens com tamanho limite
-- ------------------------------------------------------------
alter table public.relatorios drop constraint if exists relatorios_valores_validos;
alter table public.relatorios add constraint relatorios_valores_validos check (
  abertura_caixa >= 0 and fechamento_caixa >= 0 and quantidade_vendida >= 0
) not valid;

alter table public.relatorios drop constraint if exists relatorios_imagens_tamanho;
alter table public.relatorios add constraint relatorios_imagens_tamanho check (
  coalesce(length(imagem1), 0) <= 4000000 and coalesce(length(imagem2), 0) <= 4000000
) not valid;

do $$
begin
  if not exists (select 1 from public.relatorios group by data having count(*) > 1) then
    create unique index if not exists relatorios_data_uk on public.relatorios (data);
  else
    raise notice 'Há mais de um relatório na mesma data; trava de um relatório por dia não ativada.';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 3. Auditoria geral
-- ------------------------------------------------------------
create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  registrado_em timestamptz not null default now(),
  tabela text not null,
  operacao text not null, -- 'insert' | 'update' | 'delete'
  registro_id text,
  antes jsonb,
  depois jsonb,
  usuario text
);

create index if not exists idx_auditoria_registro on public.auditoria (tabela, registro_id, registrado_em desc);
create index if not exists idx_auditoria_data on public.auditoria (registrado_em desc);

create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes jsonb;
  v_depois jsonb;
begin
  -- As imagens (prints) não são copiadas pra auditoria: só se mudaram.
  if tg_op <> 'INSERT' then v_antes := to_jsonb(old) - 'imagem1' - 'imagem2'; end if;
  if tg_op <> 'DELETE' then v_depois := to_jsonb(new) - 'imagem1' - 'imagem2'; end if;

  if tg_op = 'UPDATE' and (v_antes - 'updated_at') = (v_depois - 'updated_at') then
    if (to_jsonb(old) ->> 'imagem1') is not distinct from (to_jsonb(new) ->> 'imagem1')
       and (to_jsonb(old) ->> 'imagem2') is not distinct from (to_jsonb(new) ->> 'imagem2') then
      return null; -- nada mudou de verdade
    end if;
    v_depois := v_depois || jsonb_build_object('imagens_alteradas', true);
  end if;

  insert into public.auditoria (tabela, operacao, registro_id, antes, depois, usuario)
  values (
    tg_table_name,
    lower(tg_op),
    coalesce(v_depois ->> 'id', v_antes ->> 'id'),
    v_antes,
    v_depois,
    public.email_usuario_atual()
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['fechamentos', 'sangrias', 'relatorios', 'funcionarios', 'pratos'] loop
    execute format('drop trigger if exists trg_%1$s_auditoria on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_auditoria after insert or update or delete on public.%1$I
       for each row execute function public.registrar_auditoria()', t);
  end loop;
end
$$;

-- Leitura liberada como as outras tabelas; a v4 restringe a usuários autorizados.
alter table public.auditoria enable row level security;
drop policy if exists "auditoria_leitura" on public.auditoria;
create policy "auditoria_leitura" on public.auditoria for select using (true);

notify pgrst, 'reload schema';

commit;
