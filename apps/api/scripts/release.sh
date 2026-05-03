#!/bin/sh
set -e

# release.sh — boot do apps/api em producao.
# Roda Prisma migrate deploy + seed-admin (idempotente) e inicia o NestJS.
# Seed do admin so cria se nao existir; Render Free tier nao tem Shell, entao
# fazer no boot e a saida pratica.

cd "$(dirname "$0")/.."

ADMIN_URL="${DATABASE_ADMIN_URL:-$DATABASE_URL}"

echo "▶ prisma migrate deploy"
DATABASE_URL="$ADMIN_URL" \
  npx prisma migrate deploy --schema=prisma/schema.prisma

if [ "${SKIP_SEED_ADMIN:-0}" != "1" ]; then
  echo "▶ seed-admin (idempotente)"
  DATABASE_URL="$ADMIN_URL" \
    npx tsx prisma/seed-admin.ts || echo "⚠ seed-admin falhou — boot prossegue"
fi

echo "▶ starting NestJS on port ${PORT:-3333}"
exec node dist/main.js
