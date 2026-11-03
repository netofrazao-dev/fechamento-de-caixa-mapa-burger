# Mapa Burger — Fechamento de Caixa

Sistema em React + TypeScript + Vite + Supabase: fechamento de caixa (turno da manhã),
marmitas por prato, histórico, relatório mensal, relatório diário escrito, vales
(adiantamento de salário), PDFs (impressão térmica e envio por WhatsApp), modo escuro
e rascunho automático.

## 1. Files
- Extraia o zip substituindo a pasta antiga (mantenha o seu `.env`).
- `npm install`

## 2. Banco de dados (Supabase) e login — siga NESTA ORDEM

Os arquivos ficam em `supabase/`. Todos podem ser rodados de novo sem problema e não apagam dados.

**Banco novo (vazio):** rode `schema.sql`, depois os passos A a D abaixo.

**A. Antes de publicar a versão nova** (não quebram a versão que está no ar):
1. `migration_vales.sql` (só se ainda não tem a tabela de vales)
2. `migration_rascunhos.sql` (só se ainda não tem a tabela de rascunhos)
3. `migration_vales_v2.sql` — vales à prova de erro
4. `migration_v3_cadastros_integridade.sql` — banco confere as contas, auditoria, cadastros
5. `migration_v5_manter_ativo.sql` — verificação automática (impede o Supabase grátis de pausar)

**B. Crie os logins:** Supabase → Authentication → Users → *Add user* (e-mail + senha, marque
*Auto Confirm User*) para cada pessoa que usa o sistema. Depois, em Authentication → Sign In /
Providers, **desligue "Allow new users to sign up"** (ninguém se cadastra sozinho).

**C. Publique a versão nova** (merge no `main`; a Vercel publica sozinha) e confira que consegue entrar.

**D. Feche o acesso:** abra `migration_v4_seguranca.sql`, troque `COLOQUE_SEU_EMAIL_AQUI` pelo(s)
e-mail(s) de login e rode. A partir daí, só quem está logado E está na lista acessa os dados —
a chave pública que fica dentro do app não abre mais nada.

Para incluir alguém depois: crie o login (passo B) e rode
`insert into public.usuarios_autorizados (email, nome) values ('email@exemplo.com', 'Nome');`
Para tirar o acesso: `update public.usuarios_autorizados set ativo = false where email = '...';`

## 3. Variáveis de ambiente
- Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API). **Nunca** use a chave
  `service_role` no app.
- Na Vercel, configure as mesmas variáveis (Production e Preview). Framework Preset: **Vite**.

## Verificação automática (Supabase grátis não pausa)
O Supabase grátis pausa o banco após 7 dias sem uso. A Vercel chama `/api/manter-ativo`
de 3 em 3 dias, ao meio-dia UTC (`crons` no `vercel.json`). A função
(`api/manter-ativo.js`) roda `manter_ativo()` no banco: confere se as tabelas respondem e
registra a verificação na tabela `sistema_verificacoes`. Ela não devolve nenhum dado do sistema.
- Ver se está rodando: Vercel → projeto → **Settings → Cron Jobs** (botão *Run* para testar na hora)
  e **Logs** (procure `[manter-ativo]`).
- Opcional (recomendado): crie a variável `CRON_SECRET` na Vercel com um texto aleatório
  longo; aí só a própria Vercel consegue chamar a função.
- De 3 em 3 dias, e não de 5 em 5: se uma chamada falhar, a seguinte ainda acontece antes dos 7 dias.

## Segurança
- **Login obrigatório** (e-mail e senha do Supabase) + lista de e-mails autorizados no banco.
- **Regras no banco (RLS):** sem login autorizado o banco não mostra nem aceita nada; histórico,
  auditoria e fechamento de mês de vales só podem ser lidos (o próprio banco escreve neles).
- **Banco confere as contas** de cada fechamento (totais, diferença e situação), recusa valores
  negativos, ajuste sem observação, relatório duplicado na mesma data e cadastros duplicados.
- **Auditoria:** criação, alteração e exclusão de fechamentos, sangrias, relatórios, funcionários e
  pratos ficam registradas com o antes/depois e o e-mail de quem fez (tabela `auditoria`; o
  histórico de cada fechamento aparece na tela dele).
- **Cabeçalhos de segurança** na Vercel (`vercel.json`): CSP, bloqueio de iframe, HSTS, sem indexação
  em buscadores.
- Ao **Sair**, os rascunhos guardados no aparelho são apagados.

## 4. Usar
- `npm run dev` e abra http://localhost:5173
- **Fechamento**: o caixa do dia, em 5 passos numerados; o resultado aparece ao vivo no rodapé e o
  sistema avisa antes de salvar se algo parecer errado (Total LC Sistema zerado, data de outro dia,
  diferença grande sem observação). Valores aceitam vírgula ("12,50").
- **Histórico**: dias com fechamento/relatório, atalhos de período e dias sem fechamento.
- **Mensal**: totais do mês, dias sem fechamento, pratos mais vendidos e PDF.
- **Relatórios**: relatório escrito do dia (um por data), com botão para puxar valores do fechamento.
- **Vales**: adiantamentos por funcionário (veja abaixo).
- **Menu (ícone de pessoa)**: Cadastros (funcionários e pratos: renomear/desativar), trocar senha,
  tema e Sair.

## Testes
- `npm test` roda os testes automáticos (cálculos do caixa, conferências, valores em reais, datas, vales).

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
- O turno da noite foi desativado na tela (a coluna `turno` continua no banco, caso volte a ser usado).
- Cálculos do caixa: `src/lib/calculations.ts` (fonte de verdade).
- Produtos do estoque quente: `src/lib/produtos.ts`.
