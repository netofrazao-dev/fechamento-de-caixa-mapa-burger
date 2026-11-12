#!/usr/bin/env bash
# Testes de navegador: gera o app com um Supabase simulado e roda os
# roteiros. Uso: bash e2e/rodar.sh [pasta-para-prints]
set -euo pipefail
cd "$(dirname "$0")/.."
SAIDA="${1:-e2e/.saida}"
mkdir -p "$SAIDA"
VITE_SUPABASE_URL=http://supabase.test VITE_SUPABASE_ANON_KEY=chave-falsa npx vite build --outDir e2e/.dist --emptyOutDir >/dev/null
npx vite preview --outDir e2e/.dist --port 4173 --strictPort >"$SAIDA/preview.log" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -sf http://localhost:4173/ >/dev/null && break; sleep 0.5; done

falhou=0
for t in teste-vales teste-sistema teste-novidades teste-semana-senha-graficos teste-dois-aparelhos teste-cozinha; do
  echo "== $t"
  node "e2e/$t.cjs" "$SAIDA" vercel.json || falhou=1
done
exit $falhou
