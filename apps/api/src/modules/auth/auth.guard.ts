import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime
import { Reflector } from '@nestjs/core';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime
import { JwtService } from './jwt.service';

/** Metadata key para marcar rotas públicas. */
export const PUBLIC_KEY = 'is_public';

/**
 * Marca uma rota como pública (pula autenticação).
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
 * Shape do `req.auth` populado pelo AuthGuard.
 * Consumido por:
 *  - TenantContextMiddleware (popula AsyncLocalStorage)
 *  - RolesGuard (autoriza via user_memberships lookup)
 *  - AuditInterceptor (grava userId em audit_log)
 *
 * Substitui AuthContext do ClerkGuard (Plan 02.1-02).
 * NOTA: `orgRole` removido — não existe no modelo in-house.
 */
export interface AuthContext {
  userId: string; // DB user.id (UUID)
  contabilidadeId: string | null; // DB contabilidade.id (null se não em tenant)
  role: 'platform_admin' | 'tenant_user';
}

/** Nome do cookie de acesso (access token JWT, TTL 15min). */
export const ACCESS_COOKIE = 'nf_access';
/** Nome do cookie de refresh (token opaco, TTL 7d). */
export const REFRESH_COOKIE = 'nf_refresh';

interface AuthedRequest {
  cookies?: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  auth?: AuthContext;
}

/**
 * AuthGuard — primeiro guard na chain, aplicado globalmente via APP_GUARD.
 *
 * Fluxo:
 * 1. Rota @Public() → bypass (retorna true imediatamente).
 * 2. Lê cookie `nf_access` (Fastify @fastify/cookie) ou Bearer server-side.
 * 3. Valida JWT HS256 via JwtService.verifyAccess().
 * 4. Popula req.auth = { userId, contabilidadeId, role }.
 * 5. Dev fallback: ALLOW_HEADER_AUTH=true + NODE_ENV≠prod → aceita x-user-id header.
 *
 * Substitui ClerkGuard (Plan 02.1-02). RolesGuard continua inalterado.
 * SEGURANÇA:
 * - ALLOW_HEADER_AUTH só funciona em NODE_ENV≠production/staging (T-02.1-02-07).
 * - Cookie HttpOnly previne acesso JS; Secure em prod (T-02.1-02-06).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();

    // Fastify expõe cookies parsed em req.cookies (@fastify/cookie registrado em main.ts).
    // Route handlers server-side do Next repassam o access token como Bearer.
    const accessToken = req.cookies?.[ACCESS_COOKIE] ?? this.bearerToken(req);

    const isProd = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
    const headerAuthAllowed = process.env.ALLOW_HEADER_AUTH === 'true' && !isProd;

    if (!accessToken) {
      if (headerAuthAllowed && this.tryHeaderAuth(req)) return true;
      throw new UnauthorizedException('Cookie de sessão ausente');
    }

    const payload = await this.jwt.verifyAccess(accessToken);
    if (!payload) {
      if (headerAuthAllowed && this.tryHeaderAuth(req)) return true;
      throw new UnauthorizedException('Token de acesso inválido ou expirado');
    }

    req.auth = {
      userId: payload.userId,
      contabilidadeId: payload.contabilidadeId,
      role: payload.role,
    };
    return true;
  }

  /**
   * Fallback dev: lê x-user-id/x-role/x-contabilidade-id headers.
   * Ativado APENAS com ALLOW_HEADER_AUTH=true E fora de prod (T-02.1-02-07).
   */
  private tryHeaderAuth(req: AuthedRequest): boolean {
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
      contabilidadeId: contabilidadeId ?? null,
      role: roleHeader === 'platform_admin' ? 'platform_admin' : 'tenant_user',
    };
    return true;
  }

  private bearerToken(req: AuthedRequest): string | undefined {
    const authorization = Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization;
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    return match?.[1];
  }
}
