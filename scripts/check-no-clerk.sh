#!/usr/bin/env bash
# check-no-clerk.sh — Phase 02.1 CI gate
#
# Verifica que zero imports/referências de @clerk/ existem em apps/ e packages/.
# Bloqueia regressão para Clerk após Phase 02.1.
#
# Exit 0: nenhuma referência encontrada (OK).
# Exit 1: referências encontradas (FALHA — regressão detectada).
#
# Uso: bash scripts/check-no-clerk.sh
# CI:  adicionar ao job de lint/check no workflow do GitHub Actions.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Verificando ausência de imports @clerk/ em apps/ e packages/..."

MATCHES=$(grep -rE '@clerk/|clerkMiddleware|ClerkProvider' \
  "${REPO_ROOT}/apps" "${REPO_ROOT}/packages" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.json" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=dist \
  2>/dev/null || true)

if [ -n "$MATCHES" ]; then
  echo ""
  echo "FALHA: encontrados imports/referências de @clerk/ no código:"
  echo ""
  echo "$MATCHES"
  echo ""
  echo "Se esta é uma referência intencional (ex: comentário histórico em doc),"
  echo "adicione '# check-no-clerk: ignore' na linha ou atualize este script."
  echo ""
  echo "Para remover dependências Clerk:"
  echo "  pnpm --filter @nexo/web remove @clerk/nextjs @clerk/localizations svix"
  echo "  pnpm --filter @nexo/api remove @clerk/backend"
  exit 1
fi

echo "OK: nenhum import @clerk/ encontrado em apps/ e packages/."
exit 0
