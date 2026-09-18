# Mapa Burger — Fechamento de Caixa

Sistema de fechamento de caixa (React + TypeScript + Vite + Supabase),
separado por turno (manhã/noite), com conferência LC × Brendi × Sistema,
ajuste manual, histórico, relatório mensal resumido e geração de PDF.

## 1. Files

- Extraia o zip.
- `cd mapa-burger-fechamento`
- `npm install`

## 2. Database (Supabase)

1. Crie um projeto em https://supabase.com (ou use um já existente).
2. Abra **SQL Editor** no painel do Supabase.
3. Cole o conteúdo de `supabase/schema.sql` (também está dentro do zip
   na raiz do projeto, na pasta `supabase/`) e rode.
4. Isso cria as tabelas `fechamentos` e `sangrias`, com RLS liberado
   (chave anon tem acesso total — não há login ainda).

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
3. Vá em **Novo** → preencha LC, Brendi, Total LC Sistema → confira o
   resultado ao vivo → salve. Um PDF é baixado automaticamente.
4. Veja o fechamento salvo em **Histórico** e o resumo em **Mensal**.

## Deploy (Vercel)

- Suba o projeto pro GitHub e importe na Vercel.
- Configure as mesmas variáveis de ambiente (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`) em Project Settings → Environment Variables.

## Observações importantes

- **Sem autenticação ainda**: qualquer pessoa com o link acessa e
  lança fechamentos. Dá pra adicionar login (Supabase Auth) depois,
  restringindo por `auth.uid()` nas policies do `schema.sql`.
- **Vales de funcionário**: não fazem parte deste sistema (ficou combinado
  que isso vai ser tratado à parte, futuramente).
- **Um fechamento por data + turno**: o banco tem uma constraint
  `unique (data, turno)` — não dá pra salvar dois fechamentos de manhã
  no mesmo dia, por exemplo.
- A lógica de cálculo (Total LC, Total Brendi, Total Caixa, Total
  Sistema, diferença e status) está toda centralizada em
  `src/lib/calculations.ts` — é a fonte de verdade do sistema.
