import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  ForbiddenException,
  Injectable,
  type NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { type TenantScope, tenantStore } from '../../db/tenant-context';

interface AuthenticatedRequest {
  auth?: {
    userId: string;
    contabilidadeId: string | null;
    role: 'platform_admin' | 'tenant_user';
  };
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Middleware que popula `AsyncLocalStorage` com o TenantScope antes dos handlers.
 *
 * Fontes do contexto (em ordem de precedência — Plan 07):
 * 1. `req.auth` populado pelo ClerkGuard (fonte primária após Plan 07).
 *    - Empresa ativa vem do header `x-tenant-id` (setado pelo apps/web a partir
 *      de `publicMetadata.activeEmpresaId` do user Clerk — Phase 2 formaliza).
 * 2. Fallback — headers `x-tenant-id/x-user-id/x-role` (dev-only, ALLOW_HEADER_AUTH).
 *
 * Rotas públicas (health, webhooks) são excluídas no app.module.ts.
 *
 * IMPORTANT: este middleware apenas POPULA o store (AsyncLocalStorage).
 * `SET LOCAL app.current_tenant` no Postgres é feito por `withTenantContext`
 * dentro de handlers que acessam dados de tenant.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: IncomingMessage, _res: ServerResponse, next: (err?: unknown) => void): void {
    // Quando NestJS dispatcha o middleware via consumer.apply(), a request ainda
    // é o objeto raw Node (IncomingMessage). Após passar pelo adapter Fastify
    // e pelos guards, o req pode ter `auth` populado pelo ClerkGuard.
    const authReq = req as unknown as AuthenticatedRequest;
    const auth = authReq.auth;

    const headers = req.headers as Record<string, string | string[] | undefined>;
    const tenantHeader = headers['x-tenant-id'];
    const tenantId = typeof tenantHeader === 'string' ? tenantHeader : null;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validTenantId = tenantId && uuidRegex.test(tenantId) ? tenantId : null;
    if (tenantId && !validTenantId) {
      throw new UnauthorizedException('Invalid tenant id format');
    }

    if (auth) {
      // Caminho feliz Plan 07 — scope vem do JWT validado pelo ClerkGuard.
      const scope: TenantScope = {
        tenantId: validTenantId,
        contabilidadeId: auth.contabilidadeId,
        userId: auth.userId,
        role: auth.role,
      };
      tenantStore.run(scope, () => next());
      return;
    }

    // Fallback para rotas @Public() (health, webhook) ou dev ALLOW_HEADER_AUTH.
    const contabilidadeHeader = headers['x-contabilidade-id'];
    const contabilidadeId = typeof contabilidadeHeader === 'string' ? contabilidadeHeader : null;
    const userHeader = headers['x-user-id'];
    const userId = typeof userHeader === 'string' ? userHeader : null;
    const roleHeader = (headers['x-role'] as string | undefined) ?? 'anonymous';

    const isProd = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
    const headerAuthAllowed = process.env.ALLOW_HEADER_AUTH === 'true' && !isProd;
    if (roleHeader === 'platform_admin' && !headerAuthAllowed) {
      // WARNING #10 (Plan 05) — sem Clerk+ALLOW_HEADER_AUTH, não aceita platform_admin via header.
      throw new ForbiddenException(
        'Header-based platform_admin role disabled (use Clerk JWT or set ALLOW_HEADER_AUTH=true in dev)',
      );
    }

    const role: TenantScope['role'] =
      roleHeader === 'platform_admin' || roleHeader === 'tenant_user' || roleHeader === 'anonymous'
        ? roleHeader
        : 'anonymous';

    if (contabilidadeId && !uuidRegex.test(contabilidadeId)) {
      throw new UnauthorizedException('Invalid contabilidade id format');
    }
    if (userId && !uuidRegex.test(userId)) {
      throw new UnauthorizedException('Invalid user id format');
    }

    const scope: TenantScope = {
      tenantId: validTenantId,
      contabilidadeId,
      userId,
      role,
    };
    tenantStore.run(scope, () => next());
  }
}
