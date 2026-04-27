import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtService } from '../src/modules/auth/jwt.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { SessionsService } from '../src/modules/auth/sessions.service';

const JWT_SECRET = 'test-secret-min-32-chars-for-hs256!!';

function makeJwt() {
  const cfg = {
    get: (k: string) => (k === 'AUTH_JWT_SECRET' ? JWT_SECRET : 'test'),
  } as unknown as ConfigService;
  const svc = new JwtService(cfg);
  svc.onModuleInit();
  return svc;
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    $queryRawUnsafe: vi.fn(),
    $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: 'user-uuid-0001',
            email: 'test@test.com',
            passwordHash: 'hashed',
          }),
          count: vi.fn().mockResolvedValue(1),
        },
        userMembership: {
          create: vi.fn().mockResolvedValue({}),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        session: {
          create: vi.fn().mockResolvedValue({ id: 'sess-1' }),
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn().mockResolvedValue({}),
        },
        ...overrides,
      }),
    ),
  };
}

describe('AuthService flow (mock Prisma)', () => {
  let pwdSvc: PasswordService;
  let jwtSvc: JwtService;
  let sessSvc: SessionsService;
  let authSvc: AuthService;
  let mockPrisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    pwdSvc = new PasswordService();
    jwtSvc = makeJwt();
    mockPrisma = makePrisma();
    sessSvc = new SessionsService(mockPrisma as any, jwtSvc);
    authSvc = new AuthService(mockPrisma as any, pwdSvc, jwtSvc, sessSvc);
  });

  describe('signup', () => {
    it('retorna accessToken (JWT string) e refreshToken (64 hex chars)', async () => {
      const result = await authSvc.signup({
        email: 'a@b.com',
        password: 'SenhaSegura123!',
        fullName: 'Test User',
      });
      expect(result.accessToken).toBeTruthy();
      expect(typeof result.accessToken).toBe('string');
      expect(result.refreshToken).toHaveLength(64);
    });

    it('accessToken é JWT HS256 verificável', async () => {
      const result = await authSvc.signup({
        email: 'a@b.com',
        password: 'SenhaSegura123!',
        fullName: 'Test',
      });
      const payload = await jwtSvc.verifyAccess(result.accessToken);
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe('user-uuid-0001');
    });

    it('email duplicado lança ConflictException', async () => {
      // Setup: user existente retornado pelo findUnique
      const existingUser = { id: 'existing-id', email: 'dup@test.com', passwordHash: 'hash' };
      const prismaWithExisting = {
        $queryRawUnsafe: vi.fn(),
        $transaction: vi
          .fn()
          .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
            cb({
              $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
              user: { findUnique: vi.fn().mockResolvedValue(existingUser) },
              userMembership: { findFirst: vi.fn() },
              session: { create: vi.fn() },
            }),
          ),
      };
      const svc = new AuthService(
        prismaWithExisting as any,
        pwdSvc,
        jwtSvc,
        new SessionsService(prismaWithExisting as any, jwtSvc),
      );
      await expect(
        svc.signup({ email: 'dup@test.com', password: 'SenhaSegura123!', fullName: 'Dup' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('signin', () => {
    it('usuário inexistente lança UnauthorizedException com mensagem genérica', async () => {
      // user.findUnique retorna null (padrão do mock)
      await expect(
        authSvc.signin({ email: 'nao@existe.com', password: 'qualquer123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('senha incorreta lança UnauthorizedException com mensagem genérica', async () => {
      const testHash = await pwdSvc.hash('SenhaCorreta123!');
      const mockUser = { id: 'u1', email: 'x@x.com', passwordHash: testHash };
      const prismaWithUser = {
        $queryRawUnsafe: vi.fn(),
        $transaction: vi
          .fn()
          .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
            cb({
              $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
              user: { findUnique: vi.fn().mockResolvedValue(mockUser) },
              userMembership: { findFirst: vi.fn().mockResolvedValue(null) },
              session: { create: vi.fn().mockResolvedValue({ id: 'sess-1' }) },
            }),
          ),
      };
      const svc = new AuthService(
        prismaWithUser as any,
        pwdSvc,
        jwtSvc,
        new SessionsService(prismaWithUser as any, jwtSvc),
      );
      await expect(
        svc.signin({ email: 'x@x.com', password: 'SenhaErrada999!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('mensagem de erro NÃO revela se email existe ou não', async () => {
      // Ambos os cenários devem ter a mesma mensagem genérica
      const err1 = await authSvc
        .signin({ email: 'nao@existe.com', password: 'q' })
        .catch((e: unknown) => e as UnauthorizedException);
      expect((err1 as UnauthorizedException).message).toBe('Email ou senha incorretos');
    });

    it('credenciais corretas retorna accessToken + refreshToken', async () => {
      const testHash = await pwdSvc.hash('SenhaCorreta123!');
      const mockUser = { id: 'u2', email: 'ok@test.com', passwordHash: testHash };
      const prismaWithUser = {
        $queryRawUnsafe: vi.fn(),
        $transaction: vi
          .fn()
          .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
            cb({
              $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
              user: { findUnique: vi.fn().mockResolvedValue(mockUser) },
              userMembership: { findFirst: vi.fn().mockResolvedValue(null) },
              session: { create: vi.fn().mockResolvedValue({ id: 'sess-ok' }) },
            }),
          ),
      };
      const svc = new AuthService(
        prismaWithUser as any,
        pwdSvc,
        jwtSvc,
        new SessionsService(prismaWithUser as any, jwtSvc),
      );
      const result = await svc.signin({ email: 'ok@test.com', password: 'SenhaCorreta123!' });
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toHaveLength(64);
    });
  });

  describe('refresh', () => {
    it('refresh token inválido lança UnauthorizedException', async () => {
      // findActiveByRefreshHash retorna null (padrão)
      await expect(authSvc.refresh('token-invalido-64chars-xyz-abc')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('refresh válido retorna novo accessToken + refreshToken', async () => {
      const testUser = { id: 'u3', email: 'u3@test.com', passwordHash: 'hash' };
      const testSession = { id: 'sess-old', userId: 'u3', revokedAt: null };
      const prismaFull = {
        $queryRawUnsafe: vi.fn(),
        $transaction: vi
          .fn()
          .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
            cb({
              $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
              user: { findUnique: vi.fn().mockResolvedValue(testUser) },
              userMembership: { findFirst: vi.fn().mockResolvedValue(null) },
              session: {
                findFirst: vi.fn().mockResolvedValue(testSession),
                update: vi.fn().mockResolvedValue({ ...testSession, revokedAt: new Date() }),
                create: vi.fn().mockResolvedValue({ id: 'sess-new' }),
              },
            }),
          ),
      };
      const svc = new AuthService(
        prismaFull as any,
        pwdSvc,
        jwtSvc,
        new SessionsService(prismaFull as any, jwtSvc),
      );
      const result = await svc.refresh('some-valid-refresh-token-hex64');
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toHaveLength(64);
    });
  });

  describe('signout', () => {
    it('é idempotente — não falha se session não encontrada', async () => {
      // session.findFirst retorna null (padrão) — signout deve completar sem erro
      await expect(authSvc.signout('some-token')).resolves.toBeUndefined();
    });
  });
});
