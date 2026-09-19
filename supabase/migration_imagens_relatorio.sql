-- ============================================================
-- Migração: guarda os 2 prints anexados junto com o relatório
-- diário (base64), pra não precisar anexar de novo toda vez.
-- Rode isso no SQL Editor do Supabase.
-- ============================================================

alter table public.relatorios
  add column if not exists imagem1 text,
  add column if not exists imagem2 text;
