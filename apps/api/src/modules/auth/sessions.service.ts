import { Injectable } from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime
import { PrismaService } from '../../db/prisma.service';
import { withTenantContext } from '../../db/with-tenant';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime
import { JwtService } from './jwt.service';

/**
 * SessionsService — gerencia sessions de refresh token.
 *
 * Sessions rodam com platform_admin context porque auth acontece antes do
 * tenant context ser resolvido — RLS permissiva na tabela sessions (Plan 02.1-01).
 *
 * SEGURANÇA:
 * - Armazena apenas sha256(refreshToken) — token original jamais persiste em DB.
 * - rotateRefresh revoga ANTES de criar nova session (single-use T-02.1-02-04).
 * - findActiveByRefreshHash filtra revokedAt=null e expiresAt>now.
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private adminCtx() {
    return { tenantId: null as null, role: 'platform_admin' as const };
  }

  /** Cria nova session com hash sha256 do refreshToken. */
  async create(opts: {
    userId: string;
    refreshToken: string;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    const refreshTokenHash = this.jwt.hashRefreshToken(opts.refreshToken);
    const expiresAt = new Date(Date.now() + this.jwt.refreshTtlMs());
    return withTenantContext(this.prisma, this.adminCtx(), (tx) =>
      tx.session.create({
        data: {
          userId: opts.userId,
          refreshTokenHash,
          ip: opts.ip ?? null,
          userAgent: opts.userAgent ?? null,
          expiresAt,
        },
      }),
    );
  }

  /**
   * Busca session ativa pelo hash do refresh token.
   * Retorna null se inexistente, revogada ou expirada.
   */
  async findActiveByRefreshHash(hash: string) {
    return withTenantContext(this.prisma, this.adminCtx(), (tx) =>
      tx.session.findFirst({
        where: {
          refreshTokenHash: hash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
    );
  }

  /** Revoga session marcando revokedAt = now(). */
  async revoke(sessionId: string) {
    return withTenantContext(this.prisma, this.adminCtx(), (tx) =>
      tx.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      }),
    );
  }

  /**
   * Rotaciona refresh token (single-use):
   * 1. Revoga sessão antiga.
   * 2. Gera novo refreshToken opaco.
   * 3. Cria nova session com novo hash.
   * Retorna o novo refreshToken para enviar ao cliente.
   */
  async rotateRefresh(
    oldSessionId: string,
    opts: { userId: string; ip?: string | null; userAgent?: string | null },
  ): Promise<{ refreshToken: string }> {
    // Passo 1: revogar antes de criar (T-02.1-02-04 — single-use enforcement)
    await this.revoke(oldSessionId);
    // Passo 2: novo token opaco
    const refreshToken = this.jwt.signRefresh();
    // Passo 3: persistir nova session
    await this.create({ ...opts, refreshToken });
    return { refreshToken };
  }
}
