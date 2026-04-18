import type { Prisma, PrismaClient } from '@prisma/client';
import { tenantStore, type TenantScope } from './tenant-context';

/**
 * Regex de validação UUID v1-v5 (36 chars, 5 grupos hex com hífens).
 * Usado como defesa contra SQL injection via SET LOCAL — o helper
 * interpola os valores como string literal no SQL, então precisamos
 * garantir que só UUIDs válidos passam.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Roles aceitos em `SET LOCAL app.role`. Whitelist fechada. */
const VALID_ROLES: ReadonlySet<TenantScope['role']> = new Set([
  'platform_admin',
  'tenant_user',
  'anonymous',
]);

/**
 * Executa `callback` dentro de uma transação Prisma com `SET LOCAL app.current_tenant`
 * configurado no Postgres. RLS policies leem esse GUC para filtrar linhas.
 *
 * PITFALLS.md #1 — Usar `SET LOCAL` (não `SET`) garante que o escopo é a transação,
 * evitando contaminação via connection pool. CVE-2024-10976 e CVE-2025-8713
 * mostram que pool poisoning é real; esta função é a linha de defesa.
 *
 * Proteção anti-injection: UUIDs são validados via regex ANTES de ir para o SQL.
 * Role é validada contra whitelist fechada.
 *
 * @example
 * ```ts
 * await withTenantContext(
 *   prisma,
 *   { tenantId: 'uuid-A', userId: 'user-1', role: 'tenant_user' },
 *   async (tx) => {
 *     return tx.empresa.findMany(); // RLS filtra pelo tenant A
 *   },
 * );
 * ```
 */
export async function withTenantContext<T>(
  prisma: PrismaClient,
  scope: Partial<TenantScope> & { tenantId: string | null },
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const fullScope: TenantScope = {
    tenantId: scope.tenantId,
    contabilidadeId: scope.contabilidadeId ?? null,
    userId: scope.userId ?? null,
    role: scope.role ?? 'tenant_user',
  };

  // ==========================================================================
  // Validação anti-SQL-injection — ANTES de tocar Postgres.
  // Como os valores vão via SET LOCAL como string literal (não há parameter binding
  // suportado pelo SET), validamos explicitamente contra regex UUID e whitelist de role.
  // ==========================================================================
  const tenantValue = fullScope.tenantId ?? '';
  const contabilidadeValue = fullScope.contabilidadeId ?? '';
  const userValue = fullScope.userId ?? '';

  if (tenantValue && !UUID_REGEX.test(tenantValue)) {
    throw new Error(`Invalid tenantId UUID: ${tenantValue}`);
  }
  if (contabilidadeValue && !UUID_REGEX.test(contabilidadeValue)) {
    throw new Error(`Invalid contabilidadeId UUID: ${contabilidadeValue}`);
  }
  if (userValue && !UUID_REGEX.test(userValue)) {
    throw new Error(`Invalid userId UUID: ${userValue}`);
  }
  if (!VALID_ROLES.has(fullScope.role)) {
    throw new Error(`Invalid role: ${fullScope.role}`);
  }

  return prisma.$transaction(async (tx) => {
    // SET LOCAL para o escopo da transação. Vazamento entre pool conns bloqueado.
    // Uso de $executeRawUnsafe com valores validados acima.
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${tenantValue}'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.current_contabilidade = '${contabilidadeValue}'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.current_user = '${userValue}'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.role = '${fullScope.role}'`);

    return tenantStore.run(fullScope, () => callback(tx));
  });
}
