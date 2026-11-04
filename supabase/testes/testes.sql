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
set role anon;
select public.t_deve_falhar('select count(*) from copias_seguranca', 'permission denied', 'sem login não lê cópias');
reset role;

\echo 'TODOS OS TESTES DO BANCO PASSARAM'
