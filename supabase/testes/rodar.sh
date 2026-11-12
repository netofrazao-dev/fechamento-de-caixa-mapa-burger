#!/usr/bin/env bash
# Roda todas as migrações num Postgres limpo (duas vezes, pra provar que
# podem ser repetidas) e depois os testes. Usa as variáveis PG* do psql.
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL="psql -X -q -v ON_ERROR_STOP=1"

$PSQL -f testes/preparar.sql >/dev/null 2>&1
$PSQL -f schema.sql >/dev/null 2>&1
$PSQL -f testes/dados_antigos.sql

# A v4 precisa de um e-mail de verdade no lugar do exemplo.
sed "s/COLOQUE_SEU_EMAIL_AQUI/dono@teste.com/" migration_v4_seguranca.sql > /tmp/v4_teste.sql

for rodada in 1 2; do
  for f in migration_vales.sql migration_rascunhos.sql migration_vales_v2.sql migration_v3_cadastros_integridade.sql \
           migration_v5_manter_ativo.sql /tmp/v4_teste.sql migration_v6_copias_seguranca.sql migration_v7_acerto_mes.sql \
           migration_v8_produtos_estoque.sql migration_v9_loja_fechada.sql migration_v10_marmitas_suprimento.sql migration_v12_remover_cozinha.sql; do
    # Cada arquivo vai como um comando só, igual ao SQL Editor do Supabase.
    $PSQL -c "$(cat "$f")" >/dev/null 2>&1 || { echo "ERRO na migração $f (rodada $rodada)"; $PSQL -c "$(cat "$f")"; exit 1; }
  done
  echo "migrações ok (rodada $rodada)"
done

# Sem trocar o e-mail, a v4 tem que se recusar a rodar.
if $PSQL -c "$(cat migration_v4_seguranca.sql)" >/dev/null 2>&1; then
  echo "ERRO: a v4 rodou sem trocar o e-mail"; exit 1
fi
echo "v4 recusa rodar sem e-mail: ok"

$PSQL -f testes/testes.sql 2>&1 | sed -n 's/^psql:.*NOTICE:  //p; s/^NOTICE:  //p; /TODOS OS TESTES/p; /FALHOU/p; /ERROR/p'
