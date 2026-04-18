import {
  Injectable,
  type NestMiddleware,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tenantStore, type TenantScope } from '../../db/tenant-context';

/**
 * Middleware que popula `AsyncLocalStorage` com o TenantScope antes dos handlers.
 *
 * Fontes do contexto (em ordem de precedência):
 * 1. JWT claims (Plan 07 plugará Clerk aqui)
 * 2. Header `x-tenant-id` + `x-user-id` + `x-role` (útil para testes/admin CLI)
 *
 * Rotas públicas (health, docs, webhooks externos) devem ser excluídas no app.module.ts.
 *
 * IMPORTANT: este middleware apenas POPULA o store. O `SET LOCAL app.current_tenant`
 * no Postgres é feito pelo `withTenantContext` helper dentro de handlers específicos.
 * Aqui apenas damos o "tenantId disponível no async context".
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: IncomingMessage, _res: ServerResponse, next: (err?: unknown) => void): void {
    // TODO (Plan 07): ler de req['auth'] populado pelo ClerkGuard
    // Por enquanto: headers como placeholder para testes/admin CLI
    const headers = req.headers as Record<string, string | string[] | undefined>;
    const tenantId = (headers['x-tenant-id'] as string | undefined) ?? null;
    const contabilidadeId = (headers['x-contabilidade-id'] as string | undefined) ?? null;
    const userId = (headers['x-user-id'] as string | undefined) ?? null;
    const roleHeader = (headers['x-role'] as string | undefined) ?? 'anonymous';

    // REVISÃO WARNING #10 — header-based auth SÓ é aceita se ALLOW_HEADER_AUTH=true
    // E NODE_ENV != production. Fecha janela entre Plan 05 (wave 2) e Plan 07 (wave 3)
    // onde qualquer request com header x-role=platform_admin bypassaria RLS.
    const isProd = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
    const headerAuthAllowed = process.env.ALLOW_HEADER_AUTH === 'true' && !isProd;
    if (roleHeader === 'platform_admin' && !headerAuthAllowed) {
      throw new ForbiddenException(
        'Header-based platform_admin role disabled (set ALLOW_HEADER_AUTH=true only in dev/test; Plan 07 provides real Clerk auth)',
      );
    }

    const role: TenantScope['role'] =
      roleHeader === 'platform_admin' || roleHeader === 'tenant_user' || roleHeader === 'anonymous'
        ? roleHeader
        : 'anonymous';

    // Validar UUIDs (defesa em profundidade — withTenantContext também valida)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (tenantId && !uuidRegex.test(tenantId)) {
      throw new UnauthorizedException('Invalid tenant id format');
    }
    if (contabilidadeId && !uuidRegex.test(contabilidadeId)) {
      throw new UnauthorizedException('Invalid contabilidade id format');
    }
    if (userId && !uuidRegex.test(userId)) {
      throw new UnauthorizedException('Invalid user id format');
    }

    const scope: TenantScope = { tenantId, contabilidadeId, userId, role };

    tenantStore.run(scope, () => next());
  }
}
