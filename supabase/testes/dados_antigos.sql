-- Dados como a versão antiga do app gravava (nomes bagunçados, sem id).
insert into public.vales (funcionario, data, valor, observacao) values
  ('Pâmela', '2026-10-02', 50, 'remédio'),
  ('pamela ', '2026-10-05', 30.5, null),
  ('PAMELA', '2026-10-07', 19.5, ''),
  ('Neto', '2026-10-03', 100, null),
  ('Joaozinho', '2026-10-04', 25, null),
  ('joãozinho', '2026-09-28', 40, null);
