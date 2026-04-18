import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime (reflection-based injection).
import { Reflector } from '@nestjs/core';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime (reflection-based injection).
import { PrismaService } from '../../db/prisma.service';
import { withTenantContext } from '../../db/with-tenant';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime (reflection-based injection).
import { ClerkStrategy } from './clerk.strategy';

export const PUBLIC_KEY = 'is_public';

/**
 * Marca uma rota como pública (pula autenticação).
 * Usado em /api/health, webhooks externos, etc.
 *
 * @example
 * ```ts
 * @Public()
 * @Get('health')
 * health() {}
 * ```
 */
export const Public = (): MethodDecorator => SetMetadata(PUBLIC_KEY, true);

/**
 * Shape do `req.auth` populado pelo ClerkGuard.
 * Consumido por:
 *  - TenantContextMiddleware (popula AsyncLocalStorage)
 *  - RolesGuard (autoriza via user_memberships)
 *  - @Auditable/AuditInterceptor (grava user_id em audit_log)
 */
export interface AuthContext {
  userId: string; // DB user.id (NÃO clerkUserId)
  clerkUserId: string;
  contabilidadeId: string | null; // DB contabilidade.id (NÃO clerk org id)
  orgRole: string | null;
  role: 'platform_admin' | 'tenant_user';
}

interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  auth?: AuthContext;
}

/**
 * ClerkGuard — primeiro guard na chain, aplicado globalmente via APP_GUARD.
 *
 * Fluxo:
 * 1. Rota @Public() → bypass.
 * 2. Extrai Bearer token do Authorization header.
 * 3. Valida via ClerkStrategy (verifyToken com CLERK_SECRET_KEY).
 * 4. Resolve User DB pelo clerkUserId (lookup via platform_admin bypass).
 * 5. Resolve Contabilidade DB pelo clerkOrgId (se user em org).
 * 6. Popula req.auth → consumido por middleware/guards/audit.
 *
 * Ordem de guards (app.module.ts): ClerkGuard → RolesGuard.
 */
@Injectable()
export class ClerkGuard implements CanActivate {
  private readonly logger = new Logger(ClerkGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly clerk: ClerkStrategy,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Rotas @Public() não exigem auth
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = req.headers.authorization;
    const rawHeader = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const token = rawHeader?.replace(/^Bearer\s+/i, '').trim();

    // Fallback dev: ALLOW_HEADER_AUTH aceita headers x-user-id/x-role
    // (padrão Plan 05 para smoke tests sem Clerk) — SOMENTE fora de prod.
    const isProd = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
    const headerAuthAllowed = process.env.ALLOW_HEADER_AUTH === 'true' && !isProd;

    if (!token) {
      if (headerAuthAllowed && this.tryHeaderAuth(req)) return true;
      throw new UnauthorizedException('Missing Authorization header');
    }

    const claims = await this.clerk.verify(token);
    if (!claims) {
      // Em dev sem Clerk provisionado, permite fallback header se configurado
      if (headerAuthAllowed && this.tryHeaderAuth(req)) return true;
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Lookup User DB via clerkUserId.
    // withTenantContext({ role: 'platform_admin' }) seta SET LOCAL app.role='platform_admin',
    // liberando as policies RLS para a query identity-scoped.
    const user = await withTenantContext(
      this.prisma,
      { tenantId: null, role: 'platform_admin' },
      (tx) => tx.user.findUnique({ where: { clerkUserId: claims.userId } }),
    );

    if (!user) {
      this.logger.warn({ clerkUserId: claims.userId }, 'user_not_synced_yet');
      throw new UnauthorizedException(
        `User with clerkUserId=${claims.userId} not found in DB. Webhook may not have synced yet.`,
      );
    }

    // Lookup Contabilidade se user está numa Organization
    let contabilidadeId: string | null = null;
    const orgId = claims.orgId;
    if (orgId) {
      const contabilidade = await withTenantContext(
        this.prisma,
        { tenantId: null, role: 'platform_admin' },
        (tx) => tx.contabilidade.findUnique({ where: { clerkOrgId: orgId } }),
      );
      contabilidadeId = contabilidade?.id ?? null;
    }

    const role: 'platform_admin' | 'tenant_user' =
      claims.publicMetadata.role === 'platform_admin' ? 'platform_admin' : 'tenant_user';

    req.auth = {
      userId: user.id,
      clerkUserId: claims.userId,
      contabilidadeId,
      orgRole: claims.orgRole,
      role,
    };

    return true;
  }

  /**
   * Fallback dev — popula req.auth a partir de headers x-user-id/x-role/x-contabilidade-id.
   * Só ativa com ALLOW_HEADER_AUTH=true E fora de prod (WARNING #10 do Plan 05).
   */
  private tryHeaderAuth(req: AuthenticatedRequest): boolean {
    const h = req.headers;
    const userId = Array.isArray(h['x-user-id'])
      ? h['x-user-id'][0]
      : (h['x-user-id'] as string | undefined);
    const roleHeader = Array.isArray(h['x-role'])
      ? h['x-role'][0]
      : (h['x-role'] as string | undefined);
    const contabilidadeId = Array.isArray(h['x-contabilidade-id'])
      ? h['x-contabilidade-id'][0]
      : (h['x-contabilidade-id'] as string | undefined);

    if (!userId) return false;

    req.auth = {
      userId,
      clerkUserId: `dev_${userId}`,
      contabilidadeId: contabilidadeId ?? null,
      orgRole: null,
      role: roleHeader === 'platform_admin' ? 'platform_admin' : 'tenant_user',
    };
    return true;
  }
}
