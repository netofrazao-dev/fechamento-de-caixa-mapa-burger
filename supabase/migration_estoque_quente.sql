-- ============================================================
-- Migração: simplifica o relatório diário — remove Estoque
-- início/final e deixa só o Estoque quente (grade de produtos,
-- sem data/hora). Rode isso no SQL Editor do Supabase.
--
-- Se você já tinha salvo relatórios com estoque início/final
-- preenchido, esses dados serão perdidos (só essas duas colunas).
-- ============================================================

alter table public.relatorios
  drop column if exists estoque_inicio,
  drop column if exists estoque_final;

alter table public.relatorios
  alter column estoque_quente set default '{"itens": []}'::jsonb;

-- Normaliza registros antigos que tinham estoque_quente como lista
-- livre (formato anterior) para o novo formato { itens: [] }.
update public.relatorios
set estoque_quente = '{"itens": []}'::jsonb
where jsonb_typeof(estoque_quente) <> 'object';
