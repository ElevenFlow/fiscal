#!/usr/bin/env bash
# Reseta o Postgres local: derruba container + volume + sobe do zero.
# Re-executa infra/postgres/init.sql para recriar roles e extensões.
# Uso: bash scripts/db-reset.sh

set -euo pipefail

echo "[db-reset] Parando containers..."
docker compose down

echo "[db-reset] Removendo volume nexofiscal_postgres_data..."
docker volume rm nexofiscal_postgres_data 2>/dev/null || echo "[db-reset] Volume não existia."

echo "[db-reset] Subindo Postgres fresco..."
docker compose up -d postgres

echo "[db-reset] Aguardando healthcheck..."
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    echo "[db-reset] Postgres pronto!"
    break
  fi
  sleep 1
done

echo "[db-reset] Validando roles..."
docker compose exec -T postgres psql -U postgres -d nexofiscal_dev -c "\du" | grep -E "app_user|app_admin"

echo "[db-reset] Validando extensões..."
docker compose exec -T postgres psql -U postgres -d nexofiscal_dev -c "SELECT extname FROM pg_extension;" | grep -E "uuid-ossp|pgcrypto"

echo "[db-reset] Concluído."
