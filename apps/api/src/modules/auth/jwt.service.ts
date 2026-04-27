import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface AccessTokenPayload {
  userId: string;
  contabilidadeId: string | null;
  role: 'platform_admin' | 'tenant_user';
}

const ACCESS_TTL_S = 15 * 60;

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
    const now = Math.floor(Date.now() / 1000);
    return this.signHs256({
      sub: payload.userId,
      contabilidadeId: payload.contabilidadeId,
      role: payload.role,
      iat: now,
      exp: now + ACCESS_TTL_S,
    });
  }

  /**
   * Verifica access token JWT HS256.
   * Retorna payload ou null se inválido/expirado/secret errado (nunca lança).
   */
  async verifyAccess(token: string): Promise<AccessTokenPayload | null> {
    try {
      const payload = this.verifyHs256(token);
      if (!payload.sub) return null;
      return {
        userId: String(payload.sub),
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

  private signHs256(payload: Record<string, unknown>): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlJson(header);
    const encodedPayload = this.base64UrlJson(payload);
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = createHmac('sha256', this.secret).update(signingInput).digest('base64url');
    return `${signingInput}.${signature}`;
  }

  private verifyHs256(token: string): Record<string, unknown> {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      throw new Error('Invalid JWT format');
    }

    const signingInput = `${parts[0]}.${parts[1]}`;
    const expected = createHmac('sha256', this.secret).update(signingInput).digest();
    const actual = Buffer.from(parts[2], 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new Error('Invalid JWT signature');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    const exp = typeof payload.exp === 'number' ? payload.exp : 0;
    if (exp <= Math.floor(Date.now() / 1000)) {
      throw new Error('JWT expired');
    }
    return payload;
  }

  private base64UrlJson(value: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }
}
