# Mapa Burger — Fechamento de Caixa

Sistema em React + TypeScript + Vite + Supabase: fechamento de caixa (turno da manhã),
marmitas por prato, histórico, relatório mensal, relatório diário escrito, vales
(adiantamento de salário), PDFs (impressão térmica e envio por WhatsApp), modo escuro
e rascunho automático.

## 1. Files
- Extraia o zip substituindo a pasta antiga (mantenha o seu `.env`).
- `npm install`

## 2. Database (Supabase)
- **Banco novo:** SQL Editor → cole `supabase/schema.sql` e rode.
- **Banco já existente:** rode só o que ainda não rodou. Para esta versão:
  `supabase/migration_vales.sql` (se ainda não tem a tabela de vales) e depois
  `supabase/migration_rascunhos.sql` (rascunhos sincronizados entre aparelhos).

## 3. Environment Variables
- Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API).
- Na Vercel, configure as mesmas variáveis. Framework Preset: **Vite**.

## 4. Test
- `npm run dev` e abra http://localhost:5173
- **Novo**: fechamento do dia (só turno da manhã). **Vales**: lançar e ver o total por funcionário no mês.

## Testes
- `npm test` roda os testes automáticos (cálculos do caixa, datas, remoção de acentos).

## Observações
- Rascunhos: salvos no navegador na hora e no Supabase em segundo plano (tabela `rascunhos`),
  então dá pra começar no celular e continuar no computador.
- Fechamentos e vales podem ser editados (lápis / botão "Editar").
- Datas usam o fuso local (não UTC), então à noite o "hoje" continua certo.
- Sem autenticação ainda (qualquer pessoa com o link acessa).
- O turno da noite foi desativado na tela (a coluna `turno` continua no banco, caso volte a ser usado).
- Cálculos do caixa: `src/lib/calculations.ts` (fonte de verdade).
- Produtos do estoque quente: `src/lib/produtos.ts`.
