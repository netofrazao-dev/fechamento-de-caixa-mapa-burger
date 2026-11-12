-- ============================================================
-- Testes automáticos do banco (rodam no GitHub a cada mudança).
-- Qualquer verificação que não bater interrompe com erro.
-- ============================================================
\set ON_ERROR_STOP 1
\set QUIET 1

create or replace function public.t_confere(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

create or replace function public.t_deve_falhar(sql text, trecho text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if position(lower(trecho) in lower(sqlerrm)) = 0 then
      raise exception 'FALHOU: % (erro diferente: "%", esperava "%")', msg, sqlerrm, trecho;
    end if;
    raise notice 'ok: %', msg;
    return;
  end;
  raise exception 'FALHOU: % (deveria ter sido recusado)', msg;
end $$;
grant execute on function public.t_confere(boolean, text), public.t_deve_falhar(text, text, text) to anon, authenticated;

create or replace function public.t_como(email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', email)::text, false);
end $$;

-- ---------------- Vales v2 (dados antigos ligados ao cadastro) ----------------
select public.t_confere((select count(*) = 0 from vales where funcionario_id is null), 'todo vale antigo ficou ligado a um funcionário');
select public.t_confere((select count(distinct funcionario_id) = 1 from vales where public.normalizar_nome(funcionario) = 'pamela'), '"Pâmela", "pamela " e "PAMELA" são a mesma pessoa');
select public.t_confere((select sum(valor) = 100 from vales v join funcionarios f on f.id = v.funcionario_id where f.nome = 'Pâmela'), 'total da Pâmela = R$ 100,00');

-- ---------------- Segurança (v4): três tipos de visitante ----------------
select set_config('request.jwt.claims', '{"role":"anon"}', false);
set role anon;
select public.t_deve_falhar('select count(*) from vales', 'permission denied', 'sem login não lê vales');
select public.t_deve_falhar('select count(*) from fechamentos', 'permission denied', 'sem login não lê fechamentos');
select public.t_deve_falhar('insert into vales (funcionario, data, valor) values (''Neto'', ''2026-11-01'', 10)', 'permission denied', 'sem login não grava');
select public.t_deve_falhar('select fechar_mes_vales(''2026-10-01'')', 'permission denied', 'sem login não fecha mês');
select public.t_confere((select (manter_ativo() ->> 'ok')::boolean), 'verificação automática funciona sem login (v5)');
reset role;

select public.t_como('intruso@teste.com');
set role authenticated;
select public.t_confere((select count(*) = 0 from vales), 'logado mas não autorizado não vê nada');
select public.t_deve_falhar('insert into vales (funcionario, data, valor) values (''Neto'', ''2026-11-01'', 10)', 'row-level security', 'logado não autorizado não grava');
select public.t_deve_falhar('select fechar_mes_vales(''2026-10-01'')', 'Acesso negado', 'logado não autorizado não fecha mês');
reset role;

select public.t_como('dono@teste.com');
set role authenticated;
select public.t_confere(usuario_autorizado(), 'dono autorizado');
select public.t_confere((select count(*) = 6 from vales), 'dono vê os vales');

-- ---------------- Vales: exclusão, histórico, mês fechado ----------------
insert into vales (funcionario, data, valor) values ('  neto  ', '2026-11-10', 20);
select public.t_confere((select funcionario = 'Neto' from vales where data = '2026-11-10'), 'nome bagunçado vira o nome do cadastro');
delete from vales where data = '2026-11-10';
select public.t_confere((select excluido_em is not null from vales where data = '2026-11-10'), 'DELETE vira exclusão marcada (o vale não some)');
select public.t_deve_falhar('update vales set excluido_em = now() where data = ''2026-10-03''', 'vales_exclusao_com_motivo', 'excluir exige motivo');
select public.t_deve_falhar('insert into vales (funcionario, data, valor) values (''Neto'', ''2026-11-01'', 0)', 'maior que zero', 'valor zero recusado');
select public.t_confere((select count(*) >= 2 from vales_historico where usuario = 'dono@teste.com'), 'histórico registra quem fez');
select public.t_deve_falhar('delete from vales_historico', 'permission denied', 'ninguém apaga o histórico');
select (fechar_mes_vales('2026-10-01', 'teste')).total;
select public.t_deve_falhar('insert into vales (funcionario, data, valor) values (''Neto'', ''2026-10-20'', 5)', 'já foi fechado', 'mês fechado não aceita vale novo');
select public.t_deve_falhar('update vales set valor = 1 where data = ''2026-10-03''', 'já foi fechado', 'mês fechado não aceita edição');
select reabrir_mes_vales('2026-10-01', 'teste');

-- ---------------- Integridade dos fechamentos (v3) ----------------
insert into fechamentos (data, turno, dinheiro_fechamento, pix_lc, pix_brendi, dinheiro_brendi, total_lc, total_brendi, total_caixa,
  total_lc_sistema, total_sistema, diferenca_original, ajuste_tipo, ajuste_valor, ajuste_aplicado, diferenca_final, status, observacoes)
values ('2026-10-01', 'manha', 100, 50.5, 20, 10, 150.5, 20, 170.5, 140, 170, 0.5, 'remover', 0.5, -0.5, 0, 'fechou', 'troco');
select public.t_confere(true, 'fechamento com contas certas é aceito');
select public.t_deve_falhar($$insert into fechamentos (data, turno, dinheiro_fechamento, total_lc, total_brendi, total_caixa, total_sistema, diferenca_original, diferenca_final, status)
  values ('2026-10-02','manha', 100, 999, 0, 999, 0, 999, 999, 'sobrou')$$, 'fechamentos_total_lc_confere', 'total adulterado é recusado');
select public.t_deve_falhar($$insert into fechamentos (data, turno, dinheiro_fechamento, total_lc, total_brendi, total_caixa, total_sistema, diferenca_original, diferenca_final, status)
  values ('2026-10-02','manha', 100, 100, 0, 100, 0, 100, 100, 'fechou')$$, 'fechamentos_status_confere', 'situação errada é recusada');
select public.t_deve_falhar($$insert into fechamentos (data, turno, total_lc, total_brendi, total_caixa, total_sistema, diferenca_original, ajuste_tipo, ajuste_valor, ajuste_aplicado, diferenca_final, status)
  values ('2026-10-03','manha', 0,0,0,0,0,'adicionar',5,5,5,'sobrou')$$, 'fechamentos_ajuste_com_observacao', 'ajuste sem observação é recusado');
update fechamentos set observacoes = 'troco p/ cliente' where data = '2026-10-01';
select public.t_confere((select count(*) = 2 from auditoria where tabela = 'fechamentos' and usuario = 'dono@teste.com'), 'auditoria registra criação e alteração');

-- ---------------- Acerto do mês (v7) ----------------
insert into vales (funcionario, data, valor) values ('Diogo', '2026-11-05', 30);
insert into relatorios (data, consumo_loja_mensal) values
  ('2026-11-03', '[{"pessoa":"Pâmela","item":"Coca","valor":6},{"pessoa":"Diogo","item":"X-Burger","valor":22}]'),
  ('2026-11-04', '[{"pessoa":"Pamelinha","item":"Água","valor":3}]');
select public.t_deve_falhar('select fechar_acerto_mes(''2026-11-01'')', 'sem funcionário identificado', 'acerto não fecha com consumo sem funcionário');
update relatorios set consumo_loja_mensal = jsonb_build_array(jsonb_build_object('pessoa', 'Pâmela', 'item', 'Água', 'valor', 3,
  'funcionarioId', (select id from funcionarios where nome = 'Pâmela'))) where data = '2026-11-04';
select public.t_confere((fechar_acerto_mes('2026-11-01') ->> 'total')::numeric = 61, 'acerto fecha: Diogo 30 + 22, Pâmela 6 + 3 = R$ 61,00');
select public.t_confere(exists (select 1 from vales_meses_fechados where mes = '2026-11-01'), 'mês dos vales fecha junto com o acerto');
select public.t_deve_falhar('update relatorios set consumo_loja_mensal = ''[]'' where data = ''2026-11-03''', 'acerto de 11/2026 está fechado', 'consumo travado depois do acerto');
update relatorios set estragou = '["arroz"]' where data = '2026-11-03';
select public.t_confere(true, 'outros campos do relatório continuam editáveis');
select public.t_deve_falhar('select reabrir_mes_vales(''2026-11-01'', ''por fora'')', 'reabra o acerto', 'vales só reabrem pelo acerto');
select reabrir_acerto_mes('2026-11-01', 'teste');
select public.t_confere(not exists (select 1 from vales_meses_fechados where mes = '2026-11-01'), 'reabrir acerto reabre os vales');
reset role;

-- ---------------- Produtos do estoque (v8) ----------------
select public.t_confere((select count(*) = 15 from produtos_estoque), 'estoque começa com os 15 produtos de antes (sem duplicar ao rodar 2x)');
select public.t_confere((select nome = 'Coca KS' from produtos_estoque order by ordem limit 1), 'mantém a ordem antiga');
set role anon;
select public.t_deve_falhar('select count(*) from produtos_estoque', 'permission denied', 'sem login não lê produtos');
reset role;
select public.t_como('intruso@teste.com');
set role authenticated;
select public.t_confere((select count(*) = 0 from produtos_estoque), 'não autorizado não vê produtos');
reset role;
select public.t_como('dono@teste.com');
set role authenticated;
insert into produtos_estoque (nome) values ('  Pepsi   Lata ');
select public.t_confere((select nome = 'Pepsi Lata' and ordem = 16 from produtos_estoque where nome = 'Pepsi Lata'), 'produto novo: espaços limpos e vai para o fim');
select public.t_deve_falhar('insert into produtos_estoque (nome) values (''pepsi lata'')', 'duplicate', 'não deixa nome repetido');
update produtos_estoque set ativo = false where nome = 'Monster Azul';
select public.t_confere((select not ativo from produtos_estoque where nome = 'Monster Azul'), 'desativa produto');
select public.t_deve_falhar('delete from produtos_estoque where nome = ''Monster Azul''', 'permission denied', 'apagar não pode (só desativar)');
reset role;
select public.t_confere((select count(*) >= 2 from auditoria where tabela = 'produtos_estoque'), 'auditoria registra produtos');

-- ---------------- Loja fechada (v9) ----------------
set role anon;
select public.t_deve_falhar('select count(*) from dias_loja_fechada', 'permission denied', 'sem login não lê os dias de loja fechada');
reset role;
select public.t_como('intruso@teste.com');
set role authenticated;
select public.t_deve_falhar('insert into dias_loja_fechada (data) values (''2026-10-20'')', 'row-level security', 'não autorizado não marca loja fechada');
reset role;
select public.t_como('dono@teste.com');
set role authenticated;
insert into dias_loja_fechada (data, motivo) values ('2026-10-20', '  Feriado  ');
select public.t_confere((select motivo = 'Feriado' and usuario = 'dono@teste.com' from dias_loja_fechada where data = '2026-10-20'), 'marca loja fechada (motivo limpo e quem marcou)');
select public.t_deve_falhar('insert into dias_loja_fechada (data) values (''2026-10-20'')', 'duplicate', 'não marca o mesmo dia duas vezes');
select public.t_deve_falhar('insert into dias_loja_fechada (data) values (''2026-10-01'')', 'já tem fechamento', 'não marca loja fechada num dia que já tem fechamento');
insert into fechamentos (data, turno, total_lc, total_brendi, total_caixa, total_sistema, diferenca_original, diferenca_final, status)
  values ('2026-10-20', 'manha', 0, 0, 0, 0, 0, 0, 'fechou');
select public.t_confere(not exists (select 1 from dias_loja_fechada where data = '2026-10-20'), 'fechamento salvo num dia marcado tira a marca de loja fechada');
insert into dias_loja_fechada (data) values ('2026-10-21');
delete from dias_loja_fechada where data = '2026-10-21';
select public.t_confere(not exists (select 1 from dias_loja_fechada where data = '2026-10-21'), 'desmarcar apaga a marca');
insert into dias_loja_fechada (data, motivo) values ('2026-10-27', 'folga');
reset role;
select public.t_confere((select count(*) >= 4 from auditoria where tabela = 'dias_loja_fechada'), 'auditoria registra marcar e desmarcar');

-- ---------------- Sincronia entre aparelhos (PC e celular) ----------------
-- O app grava "só se a versão ainda for a que o aparelho leu" (updated_at no relatório
-- e no fechamento; dados->>versao no rascunho compartilhado). Se outro aparelho gravou
-- no meio, nada é sobrescrito: o app junta as duas coisas e grava de novo.
select public.t_como('dono@teste.com');
set role authenticated;
insert into relatorios (data) values ('2026-10-22');
select updated_at as versao_lida from relatorios where data = '2026-10-22' \gset
with u as (update relatorios set estragou = '["arroz"]' where data = '2026-10-22' and updated_at = :'versao_lida' returning 1)
  select public.t_confere((select count(*) from u) = 1, 'relatório: grava quando a versão ainda é a que o aparelho leu');
with u as (update relatorios set estragou = '["feijão"]' where data = '2026-10-22' and updated_at = :'versao_lida' returning 1)
  select public.t_confere((select count(*) from u) = 0, 'relatório: não grava por cima quando o outro aparelho já gravou (versão mudou)');
select public.t_confere((select estragou = '["arroz"]'::jsonb and updated_at <> :'versao_lida'::timestamptz from relatorios where data = '2026-10-22'),
  'relatório: o que o outro aparelho gravou continua e a versão mudou');
select public.t_deve_falhar($$insert into relatorios (data) values ('2026-10-22')$$, 'duplicate', 'relatório do dia não é criado duas vezes (o segundo aparelho junta no que existe)');
insert into fechamentos (data, turno, total_lc, total_brendi, total_caixa, total_sistema, diferenca_original, diferenca_final, status)
  values ('2026-10-22', 'manha', 0, 0, 0, 0, 0, 0, 'fechou');
select updated_at as versao_fech from fechamentos where data = '2026-10-22' \gset
with u as (update fechamentos set observacoes = 'do PC' where data = '2026-10-22' and updated_at = :'versao_fech' returning 1)
  select public.t_confere((select count(*) from u) = 1, 'fechamento: grava sobre a versão lida');
with u as (update fechamentos set observacoes = 'do celular' where data = '2026-10-22' and updated_at = :'versao_fech' returning 1)
  select public.t_confere((select count(*) from u) = 0, 'fechamento: não grava sobre versão velha');
insert into rascunhos (chave, dados) values ('mapa-burger-rascunho-relatorio-do-dia-2026-10-22', '{"v": 2, "versao": "a1"}');
with u as (update rascunhos set dados = '{"v": 2, "versao": "b2"}' where chave = 'mapa-burger-rascunho-relatorio-do-dia-2026-10-22' and dados->>'versao' = 'a1' returning 1)
  select public.t_confere((select count(*) from u) = 1, 'rascunho compartilhado: grava sobre a versão esperada');
with u as (update rascunhos set dados = '{"v": 2, "versao": "c3"}' where chave = 'mapa-burger-rascunho-relatorio-do-dia-2026-10-22' and dados->>'versao' = 'a1' returning 1)
  select public.t_confere((select count(*) from u) = 0, 'rascunho compartilhado: não grava sobre versão velha (o outro aparelho mandou antes)');
select public.t_deve_falhar($$insert into rascunhos (chave, dados) values ('mapa-burger-rascunho-relatorio-do-dia-2026-10-22', '{}')$$, 'duplicate',
  'rascunho do dia não é criado duas vezes');
with u as (delete from rascunhos where chave = 'mapa-burger-rascunho-relatorio-do-dia-2026-10-22' and dados->>'versao' = 'a1' returning 1)
  select public.t_confere((select count(*) from u) = 0, 'limpar o rascunho depois de salvar só apaga se ninguém mandou nada novo');
delete from rascunhos where chave = 'mapa-burger-rascunho-relatorio-do-dia-2026-10-22';
delete from fechamentos where data = '2026-10-22';
delete from relatorios where data = '2026-10-22';
reset role;
set role anon;
select public.t_deve_falhar('select count(*) from rascunhos', 'permission denied', 'sem login não lê os rascunhos compartilhados');
reset role;

-- ---------------- Marmitas no relatório e suprimento no fechamento (v10) ----------------
select public.t_como('dono@teste.com');
set role authenticated;
insert into relatorios (data, marmitas) values ('2026-10-24', '[{"prato": "Estrogonofe", "quantidade": 3}]');
select public.t_confere((select marmitas -> 0 ->> 'prato' = 'Estrogonofe' from relatorios where data = '2026-10-24'), 'relatório guarda as marmitas por prato');
select public.t_deve_falhar($$update relatorios set marmitas = '{}' where data = '2026-10-24'$$, 'relatorios_marmitas_lista', 'marmitas do relatório têm que ser uma lista');
insert into fechamentos (data, turno, total_lc, total_brendi, total_caixa, total_sistema, diferenca_original, diferenca_final, status, suprimento, suprimento_obs)
  values ('2026-10-24', 'manha', 0, 0, 0, 0, 0, 0, 'fechou', 50, 'troco trazido pelo patrão');
select public.t_confere((select suprimento = 50 and diferenca_final = 0 from fechamentos where data = '2026-10-24'), 'suprimento fica guardado e não mexe na conta do caixa');
select public.t_deve_falhar($$update fechamentos set suprimento_obs = '  ' where data = '2026-10-24'$$, 'fechamentos_suprimento_valido', 'suprimento sem observação é recusado');
select public.t_deve_falhar($$update fechamentos set suprimento = -1 where data = '2026-10-24'$$, 'fechamentos_suprimento_valido', 'suprimento negativo é recusado');
update fechamentos set suprimento = 0, suprimento_obs = null where data = '2026-10-24';
select public.t_confere((select suprimento = 0 from fechamentos where data = '2026-10-24'), 'sem suprimento não precisa de observação');
delete from fechamentos where data = '2026-10-24';
delete from relatorios where data = '2026-10-24';
reset role;
select public.t_confere(not exists (select 1 from fechamentos where suprimento <> 0), 'fechamentos antigos ficam com suprimento zero');
select public.t_confere(not exists (select 1 from relatorios where marmitas <> '[]'::jsonb), 'relatórios antigos ficam sem marmitas (continuam as do fechamento)');

-- ---------------- Login da cozinha removido (v12) ----------------
select public.t_confere(to_regclass('public.estragos_cozinha') is null and to_regprocedure('public.papel_usuario()') is null
  and to_regprocedure('public.usuario_cozinha()') is null, 'login da cozinha removido (tabela e funções)');
select public.t_confere(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'usuarios_autorizados' and column_name = 'papel'),
  'lista de acesso sem o papel "cozinha"');
select public.t_como('dono@teste.com');
set role authenticated;
select public.t_confere(public.usuario_autorizado(), 'quem está na lista continua com acesso total');
reset role;

-- ---------------- Cópias de segurança (v6) ----------------
select public.t_confere((select count(*) >= 1 from copias_seguranca), 'migração já deixa uma cópia pronta');
set role anon;
select manter_ativo(); select manter_ativo();
reset role;
select public.t_confere((select count(*) = 1 from copias_seguranca), 'no máximo uma cópia a cada 2 dias');
update copias_seguranca set criada_em = now() - interval '3 days';
set role anon; select manter_ativo(); reset role;
select public.t_confere((select count(*) = 2 from copias_seguranca), 'cópia nova depois de 2 dias');
select public.t_confere((select (quantidades ? 'acertos_mes') from copias_seguranca order by id desc limit 1), 'cópia inclui os acertos');
select public.t_confere((select (quantidades ->> 'produtos_estoque')::int = 16 from copias_seguranca order by id desc limit 1), 'cópia inclui os produtos do estoque');
select public.t_confere((select (quantidades ->> 'dias_loja_fechada')::int = 1 from copias_seguranca order by id desc limit 1), 'cópia inclui os dias de loja fechada');
set role anon;
select public.t_deve_falhar('select count(*) from copias_seguranca', 'permission denied', 'sem login não lê cópias');
reset role;

\echo 'TODOS OS TESTES DO BANCO PASSARAM'
