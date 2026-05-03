#!/bin/sh
set -e

# release.sh — boot do apps/api em produção.
# Roda Prisma migrate deploy (idempotente) e inicia o NestJS.
# Seeds (admin + lookups) sao manuais via Render Shell — nao rodam a cada deploy.

cd "$(dirname "$0")/.."

ADMIN_URL="${DATABASE_ADMIN_URL:-$DATABASE_URL}"

echo "▶ prisma migrate deploy"
DATABASE_URL="$ADMIN_URL" \
  npx prisma migrate deploy --schema=prisma/schema.prisma

echo "▶ starting NestJS on port ${PORT:-3333}"
exec node dist/main.js
