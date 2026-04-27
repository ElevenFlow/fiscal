import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';

export interface AccessTokenPayload {
  userId: string;
  contabilidadeId: string | null;
  role: 'platform_admin' | 'tenant_user';
}

/** TTL do access token — 15 minutos (claim exp no JWT). */
const ACCESS_TTL = '15m';

/** TTL do refresh token — 7 dias em ms (para calcular expiresAt na session). */
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * JwtService — sign/verify de access tokens HS256 e geração de refresh tokens opacos.
 *
 * SEGURANÇA:
 * - signAccess: HS256 com secret derivado de AUTH_JWT_SECRET (mín. 32 chars).
 * - verifyAccess: retorna null em vez de lançar (JWT inválido, expirado, secret errado).
 * - signRefresh: gera 32 bytes aleatórios (64 hex chars) — opaque token.
 * - hashRefreshToken: sha256 do token opaco para armazenar em DB (T-02.1-02-04).
 * - Em prod sem AUTH_JWT_SECRET: falha no boot (fail-fast). Em dev: usa fallback com warn.
 */
@Injectable()
export class JwtService implements OnModuleInit {
  private readonly logger = new Logger(JwtService.name);
  private secret!: Uint8Array;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const raw = this.config.get<string>('AUTH_JWT_SECRET');
    if (!raw || raw.length < 32) {
      const isProd =
        this.config.get<string>('NODE_ENV') === 'production' ||
        this.config.get<string>('NODE_ENV') === 'staging';
      if (isProd) {
        throw new Error(
          'AUTH_JWT_SECRET must be at least 32 chars in production/staging (T-02.1-02-03)',
        );
      }
      // Dev fallback — nunca em prod (verificado acima)
      this.logger.warn(
        'AUTH_JWT_SECRET ausente ou < 32 chars — usando fallback de desenvolvimento. NUNCA use em produção.',
      );
      const devFallback = 'dev-only-insecure-jwt-secret-nexofiscal-2026!!';
      this.secret = new TextEncoder().encode(devFallback);
      return;
    }
    this.secret = new TextEncoder().encode(raw);
  }

  /** Emite access token JWT HS256 com TTL de 15 minutos. */
  async signAccess(payload: AccessTokenPayload): Promise<string> {
    const { SignJWT } = await import('jose');
    return new SignJWT({
      sub: payload.userId,
      contabilidadeId: payload.contabilidadeId,
      role: payload.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(ACCESS_TTL)
      .sign(this.secret);
  }

  /**
   * Verifica access token JWT HS256.
   * Retorna payload ou null se inválido/expirado/secret errado (nunca lança).
   */
  async verifyAccess(token: string): Promise<AccessTokenPayload | null> {
    try {
      const { jwtVerify } = await import('jose');
      const { payload } = await jwtVerify(token, this.secret, { algorithms: ['HS256'] });
      if (!payload.sub) return null;
      return {
        userId: payload.sub,
        contabilidadeId: (payload.contabilidadeId as string | null) ?? null,
        role: (payload.role as 'platform_admin' | 'tenant_user') ?? 'tenant_user',
      };
    } catch {
      return null;
    }
  }

  /**
   * Gera refresh token opaco: 32 bytes aleatórios → 64 chars hex.
   * Nunca armazenar diretamente — usar hashRefreshToken() para o DB.
   */
  signRefresh(): string {
    return randomBytes(32).toString('hex');
  }

  /** TTL em ms do refresh token (para calcular expiresAt na session). */
  refreshTtlMs(): number {
    return REFRESH_TTL_MS;
  }

  /**
   * Hash sha256 do refresh token para armazenar em DB (CHAR(64)).
   * Token original permanece apenas na resposta ao cliente.
   */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
