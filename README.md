# Mapa Burger — Fechamento de Caixa

Sistema em React + TypeScript + Vite + Supabase: fechamento de caixa (turno da manhã),
marmitas por prato, histórico, relatório mensal, relatório diário escrito, vales
(adiantamento de salário), PDFs (impressão térmica e envio por WhatsApp), modo escuro
e rascunho automático.

## 1. Files
- Extraia o zip substituindo a pasta antiga (mantenha o seu `.env`).
- `npm install`

## 2. Database (Supabase)
- **Banco novo:** SQL Editor → cole `supabase/schema.sql` e rode; depois rode
  `supabase/migration_vales_v2.sql`.
- **Banco já existente:** rode só o que ainda não rodou, nesta ordem:
  `supabase/migration_vales.sql` (se ainda não tem a tabela de vales),
  `supabase/migration_rascunhos.sql` (rascunhos sincronizados entre aparelhos) e
  `supabase/migration_vales_v2.sql` (vales à prova de erro — veja abaixo).
  As migrações podem ser rodadas de novo sem problema e não apagam dados.

## 3. Environment Variables
- Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API).
- Na Vercel, configure as mesmas variáveis. Framework Preset: **Vite**.

## 4. Test
- `npm run dev` e abra http://localhost:5173
- **Novo**: fechamento do dia (só turno da manhã). **Vales**: lançar e ver o total por funcionário no mês.

## Testes
- `npm test` roda os testes automáticos (cálculos do caixa, datas, remoção de acentos, vales).

## Vales (adiantamento de salário)
O total de cada funcionário no mês é o que será descontado do salário, então essa parte
é protegida no próprio banco (`supabase/migration_vales_v2.sql`), não só na tela:
- **Cada vale é ligado ao cadastro do funcionário.** "pamela", "Pâmela " e "PAMELA" são
  a mesma pessoa; o total nunca se divide por causa de grafia.
- **Vale nunca é apagado.** Excluir pede um motivo e só tira o vale do total; ele fica na
  lista "Vales excluídos" e pode ser restaurado. Até um DELETE direto vira exclusão marcada.
- **Histórico de tudo:** quem lançou, alterou, excluiu ou restaurou, e quando
  (tabela `vales_historico`, visível em "Histórico de alterações").
- **Fechar o mês:** depois de descontar na folha, feche o mês na tela de Vales. O banco
  guarda o total de cada funcionário e passa a recusar qualquer lançamento, edição ou
  exclusão naquele mês. Reabrir é possível, com motivo (fica no histórico).
- **Conferência ao lançar:** avisa vale repetido (mesma pessoa, dia e valor), valor alto
  (R$ 1.000 ou mais), data no futuro ou fora do mês atual, e mostra quanto a pessoa já
  pegou no mês. Toque duplo no botão não duplica o vale.
- **Somas em centavos inteiros** (sem erro de arredondamento).
- **Exportação:** PDF com o resumo do mês + um extrato por funcionário com linha de
  assinatura ("recebi a título de adiantamento salarial e autorizo o desconto"), e
  planilha (CSV) que abre no Excel/Google Planilhas.
- Regras na tela: `src/lib/vales.ts` (com testes em `src/lib/vales.test.ts`).

Para apagar um vale de verdade (só em caso extremo, pelo SQL Editor):
`alter table vales disable trigger trg_vales_antes_excluir;` → `delete ...;` →
`alter table vales enable trigger trg_vales_antes_excluir;`

## Observações
- Rascunhos: salvos no navegador na hora e no Supabase em segundo plano (tabela `rascunhos`),
  então dá pra começar no celular e continuar no computador.
- Fechamentos e vales podem ser editados (lápis / botão "Editar").
- Datas usam o fuso local (não UTC), então à noite o "hoje" continua certo.
- Sem autenticação ainda (qualquer pessoa com o link acessa).
- O turno da noite foi desativado na tela (a coluna `turno` continua no banco, caso volte a ser usado).
- Cálculos do caixa: `src/lib/calculations.ts` (fonte de verdade).
- Produtos do estoque quente: `src/lib/produtos.ts`.
