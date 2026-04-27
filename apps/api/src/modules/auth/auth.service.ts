import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime
import { PrismaService } from '../../db/prisma.service';
import { withTenantContext } from '../../db/with-tenant';
import type { SigninDto, SignupDto } from '@nexo/shared';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime
import { JwtService } from './jwt.service';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime
import { PasswordService } from './password.service';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime
import { SessionsService } from './sessions.service';

/** Mensagem genérica para erros de credenciais (T-02.1-02-01 — timing oracle). */
const GENERIC_AUTH_ERROR = 'Email ou senha incorretos';

/**
 * AuthService — lógica de negócio de autenticação in-house.
 *
 * SEGURANÇA:
 * - signup: email duplicado → 409 (visível ao user; timing diferente de 401 é aceitável).
 * - signin: email inexistente E senha errada → MESMA mensagem genérica (T-02.1-02-01).
 * - signout: idempotente (session não encontrada → OK sem erro).
 * - refresh: rotação single-use (T-02.1-02-04).
 * - Senha nunca retorna em resposta; hash jamais vai para logs (REDACT_PATHS).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly jwt: JwtService,
    private readonly sessions: SessionsService,
  ) {}

  private adminCtx() {
    return { tenantId: null as null, role: 'platform_admin' as const };
  }

  async signup(
    dto: SignupDto,
    ip?: string | null,
    userAgent?: string | null,
  ): Promise<{ accessToken: string; refreshToken: string; user: { id: string; email: string } }> {
    // Verificar duplicata de email
    const existing = await withTenantContext(this.prisma, this.adminCtx(), (tx) =>
      tx.user.findUnique({ where: { email: dto.email } }),
    );
    if (existing) throw new ConflictException('Email já cadastrado');

    const passwordHash = await this.password.hash(dto.password);

    const user = await withTenantContext(this.prisma, this.adminCtx(), async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          // Auto-verificar email no signup (Phase 7.1 exigirá confirmação por email)
          emailVerifiedAt: new Date(),
        },
      });

      // Primeiro user criado na plataforma vira platform_admin automaticamente (T-02.1-02-10)
      const count = await tx.user.count();
      if (count === 1) {
        await tx.userMembership.create({
          data: { userId: created.id, scopeType: 'platform', scopeId: null, role: 'admin' },
        });
      }

      return created;
    });

    // Role do access token: verificar se tem membership platform/admin
    const membership = await withTenantContext(this.prisma, this.adminCtx(), (tx) =>
      tx.userMembership.findFirst({
        where: { userId: user.id, scopeType: 'platform', role: 'admin' },
      }),
    );
    const role: 'platform_admin' | 'tenant_user' = membership ? 'platform_admin' : 'tenant_user';

    const accessToken = await this.jwt.signAccess({
      userId: user.id,
      contabilidadeId: null,
      role,
    });
    const refreshToken = this.jwt.signRefresh();
    await this.sessions.create({ userId: user.id, refreshToken, ip, userAgent });

    return { accessToken, refreshToken, user: { id: user.id, email: user.email } };
  }

  async signin(
    dto: SigninDto,
    ip?: string | null,
    userAgent?: string | null,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; role: string };
  }> {
    // Mensagem genérica em AMBOS os branches (T-02.1-02-01 — timing oracle prevention)
    const user = await withTenantContext(this.prisma, this.adminCtx(), (tx) =>
      tx.user.findUnique({ where: { email: dto.email } }),
    );
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    const ok = await this.password.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException(GENERIC_AUTH_ERROR);

    // Determinar role via UserMembership
    const membership = await withTenantContext(this.prisma, this.adminCtx(), (tx) =>
      tx.userMembership.findFirst({
        where: { userId: user.id, scopeType: 'platform', role: 'admin' },
      }),
    );
    const role: 'platform_admin' | 'tenant_user' = membership ? 'platform_admin' : 'tenant_user';

    const accessToken = await this.jwt.signAccess({
      userId: user.id,
      contabilidadeId: null,
      role,
    });
    const refreshToken = this.jwt.signRefresh();
    await this.sessions.create({ userId: user.id, refreshToken, ip, userAgent });

    return { accessToken, refreshToken, user: { id: user.id, email: user.email, role } };
  }

  async signout(refreshToken: string): Promise<void> {
    const hash = this.jwt.hashRefreshToken(refreshToken);
    const session = await this.sessions.findActiveByRefreshHash(hash);
    if (session) await this.sessions.revoke(session.id);
    // Idempotente: session não encontrada → OK sem erro
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const hash = this.jwt.hashRefreshToken(refreshToken);
    const session = await this.sessions.findActiveByRefreshHash(hash);
    if (!session) throw new UnauthorizedException('Refresh token inválido ou expirado');

    const user = await withTenantContext(this.prisma, this.adminCtx(), (tx) =>
      tx.user.findUnique({ where: { id: session.userId } }),
    );
    if (!user) throw new UnauthorizedException('Usuário não encontrado');

    // Rotacionar refresh token (single-use — T-02.1-02-04)
    const { refreshToken: newRefreshToken } = await this.sessions.rotateRefresh(session.id, {
      userId: user.id,
    });

    const membership = await withTenantContext(this.prisma, this.adminCtx(), (tx) =>
      tx.userMembership.findFirst({
        where: { userId: user.id, scopeType: 'platform', role: 'admin' },
      }),
    );
    const role: 'platform_admin' | 'tenant_user' = membership ? 'platform_admin' : 'tenant_user';

    const accessToken = await this.jwt.signAccess({
      userId: user.id,
      contabilidadeId: null,
      role,
    });
    return { accessToken, refreshToken: newRefreshToken };
  }

  async me(userId: string): Promise<Record<string, unknown>> {
    const user = await withTenantContext(this.prisma, this.adminCtx(), (tx) =>
      tx.user.findUnique({
        where: { id: userId },
        include: { memberships: true },
      }),
    );
    if (!user) throw new UnauthorizedException('Usuário não encontrado');

    // Nunca retornar passwordHash ao cliente (REDACT_PATHS + explicit strip)
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }
}
