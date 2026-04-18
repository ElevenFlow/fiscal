import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../db/prisma.service';
import { getCurrentTenant } from '../../db/tenant-context';
import { ROLES_KEY, type Role } from './roles.decorator';

/**
 * RolesGuard — valida que o user tem @Roles(...) no escopo atual.
 *
 * PLACEHOLDER (Plan 05 wave 2): este guard implementa apenas o fluxo de
 * metadata + bypass para platform_admin. A query real contra `user_memberships`
 * fica intencionalmente fora deste plano porque:
 *   1. Clerk (Plan 07) populará `req.user` e `req.auth.memberships` — a query
 *      direta ao Postgres vira cache warming redundante.
 *   2. A query em user_memberships via app_user (NOBYPASSRLS) requer context
 *      de tenant especial para autorização cross-scope que ainda não existe.
 *
 * Plan 07 substitui este guard pela implementação real que lê de `req.user`
 * via Clerk middleware. Enquanto isso, este placeholder:
 *   - early-return em rotas sem @Roles()
 *   - platform_admin bypassa sempre
 *   - scope.role (do TenantContextMiddleware) é comparado com requiredRoles
 *     apenas para o 'admin' role — outros roles exigem Clerk.
 *
 * NOTA sobre query em user_memberships: o CODE PATH será ativado em Plan 07.
 * Exemplo futuro:
 *   const memberships = await this.prisma.$queryRaw<{ role: string }[]>`
 *     SELECT role FROM user_memberships
 *     WHERE user_id = ${scope.userId}::uuid AND scope_id = ${scopeId}::uuid
 *   `;
 * (ver Plan 07 para implementação completa com tratamento de RLS).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    // PrismaService injetado para compat com Plan 07 futuro; não usado no placeholder.
    private readonly _prisma: PrismaService,
  ) {
    // referência silenciosa para evitar lint unused
    void this._prisma;
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // Rota sem @Roles() — tenant guard (quando aplicado) já validou auth básica
    }

    const scope = getCurrentTenant();
    if (!scope || !scope.userId) {
      throw new ForbiddenException('Cannot authorize: missing tenant scope');
    }

    // Admin bypass — se role 'admin' está na lista requerida E scope.role='platform_admin', ok.
    // Este é o único path funcional no placeholder; Plan 07 liga os outros roles via Clerk.
    if (requiredRoles.includes('admin') && scope.role === 'platform_admin') {
      return true;
    }

    // Placeholder: demais roles ainda não têm fonte de verdade (Clerk pendente — Plan 07).
    // Em vez de consultar user_memberships agora (RLS + bypass-de-scope é complexo e
    // será resolvido quando req.user existir), falhamos closed com mensagem clara.
    this.logger.warn(
      {
        requiredRoles,
        currentRole: scope.role,
        userId: scope.userId,
      },
      'roles_placeholder_deny',
    );
    throw new ForbiddenException(
      `RolesGuard placeholder: role check for [${requiredRoles.join(', ')}] requires Clerk integration (Plan 07). Current scope role: ${scope.role}.`,
    );
  }
}
