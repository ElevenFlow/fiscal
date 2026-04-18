import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime (reflection-based injection).
import { Reflector } from '@nestjs/core';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime (reflection-based injection).
import { PrismaService } from '../../db/prisma.service';
import { withTenantContext } from '../../db/with-tenant';
import { ROLES_KEY, type Role } from './roles.decorator';

interface AuthenticatedRequest {
  auth?: {
    userId: string; // DB user.id (setado pelo ClerkGuard — Plan 07)
    contabilidadeId: string | null;
    role: 'platform_admin' | 'tenant_user';
  };
}

/**
 * RolesGuard — valida que o user tem ao menos UM dos `@Roles(...)` requeridos.
 *
 * BLOCKER #1 fix (Plan 07):
 *   A query em `user_memberships` é envolvida em
 *   `withTenantContext({ tenantId: null, role: 'platform_admin', userId })`.
 *   Sem esse wrap, a connection `app_user` (NOBYPASSRLS) bate em
 *   FORCE ROW LEVEL SECURITY da tabela e retorna 0 linhas — toda rota
 *   com `@Roles(...)` responderia 403 permanentemente.
 *
 * Fluxo:
 *   1. Rota sem @Roles() → passa.
 *   2. Rota @Roles('admin', ...) + req.auth.role === 'platform_admin' → passa.
 *   3. Query memberships via identity-scope bypass → verifica se algum role
 *      do user está em `requiredRoles`.
 *   4. Caso nenhum match → 403 com mensagem descritiva (sem vazar metadados sensíveis).
 *
 * Ordem de guards (app.module.ts): ClerkGuard → RolesGuard.
 * ClerkGuard popula `req.auth`; este guard só confia em `req.auth`, não em
 * AsyncLocalStorage (evita TOCTOU entre middleware e guard).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Rota sem @Roles() — pulamos sem query ao DB (evita overhead em 99% das rotas).
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = req.auth;
    if (!auth?.userId) {
      throw new ForbiddenException('Cannot authorize: missing auth context');
    }

    // Platform admin bypass — FOUND-04 trata `admin` como role de plataforma.
    if (requiredRoles.includes('admin') && auth.role === 'platform_admin') {
      return true;
    }

    // BLOCKER #1 FIX: lookup em user_memberships precisa bypassar FORCE RLS.
    // withTenantContext com role='platform_admin' seta SET LOCAL app.role='platform_admin',
    // liberando a policy identity-scoped para ler as memberships do próprio user.
    // Nunca exponha isso fora do context de RBAC (é bypass legítimo para AuthN/Z lookup).
    const memberships = await withTenantContext(
      this.prisma,
      { tenantId: null, role: 'platform_admin', userId: auth.userId },
      (tx) =>
        tx.$queryRaw<{ role: string; scope_type: string; scope_id: string | null }[]>`
          SELECT role, scope_type, scope_id
          FROM user_memberships
          WHERE user_id = ${auth.userId}::uuid
        `,
    );

    const allowed = memberships.some((m) => requiredRoles.includes(m.role as Role));
    if (!allowed) {
      // Log structured para SIEM (não vaza role do user no response body).
      this.logger.warn(
        {
          requiredRoles,
          userId: auth.userId,
          foundRoles: memberships.map((m) => m.role),
        },
        'roles_denied',
      );
      throw new ForbiddenException(`Required role(s): ${requiredRoles.join(', ')}. Access denied.`);
    }

    return true;
  }
}
