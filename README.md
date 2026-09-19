# Mapa Burger — Fechamento de Caixa

Sistema de fechamento de caixa (React + TypeScript + Vite + Supabase),
separado por turno (manhã/noite), com conferência LC × Brendi × Sistema,
ajuste manual, marmitas vendidas, histórico, relatório mensal resumido,
relatório diário escrito (modelo fixo) e geração de PDF — modo claro/escuro.

## 1. Files

- Extraia o zip (substitua a pasta antiga, exceto o seu `.env`).
- `cd mapa-burger-fechamento`
- `npm install`

## 2. Database (Supabase)

**Instalação nova (banco vazio):**
1. Crie um projeto em https://supabase.com (ou use um já existente).
2. Abra **SQL Editor** no painel do Supabase.
3. Cole o conteúdo de `supabase/schema.sql` e rode. Isso cria tudo:
   `fechamentos`, `sangrias`, `relatorios`, `funcionarios` (com alguns
   nomes já cadastrados), com RLS liberado (chave anon tem acesso
   total — não há login ainda).

**Banco já existente (atualizando de uma versão anterior):** rode, na
ordem, os arquivos de migração que ainda não rodou:
`migration_marmitas_e_relatorio_diario.sql` → `migration_estoque_quente.sql`
→ `migration_imagens_relatorio.sql`. Se já rodou algum antes, pule.

## 3. Environment Variables

1. Copie `.env.example` para `.env`.
2. No painel do Supabase, vá em **Project Settings → API**.
3. Preencha:
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon
   ```

## 4. Test

1. `npm run dev`
2. Abra o endereço mostrado no terminal (geralmente http://localhost:5173).
3. Vá em **Novo** → preencha LC, Brendi, marmitas, Total LC Sistema →
   confira o resultado ao vivo → salve. Um PDF de impressão (recibo
   térmico) é baixado automaticamente.
4. Veja o fechamento salvo em **Histórico** (agrupado por dia, junto
   com o relatório escrito daquele dia) e o resumo em **Mensal**.
5. Em **Relatórios**, crie o relatório diário (modelo fixo: estragou,
   funcionários que comeram, consumo loja, sangrias, estoque quente,
   anexos de print). Use os botões **Impressão** (recibo térmico) e
   **PDF WhatsApp** (A4 detalhado, com os anexos, pra mandar pro
   contador) — são dois arquivos diferentes, com propósitos diferentes.
6. O botão de sol/lua na navegação alterna entre claro e escuro.

## Deploy (Vercel)

- Suba o projeto pro GitHub e importe na Vercel.
- **Framework Preset**: Vite (não Next.js).
- Configure as mesmas variáveis de ambiente (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`) em Project Settings → Environment Variables.
- O `vercel.json` na raiz já cuida do rewrite de SPA (rotas tipo
  `/relatorios/algum-id` funcionarem direto, sem 404).

## Observações importantes

- **Sem autenticação ainda**: qualquer pessoa com o link acessa e
  lança fechamentos/relatórios. Dá pra adicionar login (Supabase Auth)
  depois, restringindo por `auth.uid()` nas policies do `schema.sql`.
- **Vales de funcionário**: não fazem parte deste sistema (ficou combinado
  que isso vai ser tratado à parte, futuramente).
- **Um fechamento por data + turno**: o banco tem uma constraint
  `unique (data, turno)` — não dá pra salvar dois fechamentos de manhã
  no mesmo dia, por exemplo. Dá pra excluir um fechamento errado na
  tela de detalhe dele.
- **Funcionários**: a lista usada em "Funcionários que comeram" vem da
  tabela `funcionarios` — dá pra adicionar gente nova direto na tela.
- **Produtos do estoque quente**: lista fixa em `src/lib/produtos.ts`.
  Se o cardápio de bebidas mudar, edita esse arquivo.
- **Anexos do PDF WhatsApp**: as imagens são comprimidas no navegador
  antes de salvar (pra não pesar no banco) e ficam guardadas em base64
  na própria tabela `relatorios` — não precisa reanexar toda vez.
- A lógica de cálculo (Total LC, Total Brendi, Total Caixa, Total
  Sistema, diferença e status) está toda centralizada em
  `src/lib/calculations.ts` — é a fonte de verdade do sistema.
