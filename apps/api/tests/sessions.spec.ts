import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionsService } from '../src/modules/auth/sessions.service';

const USER_ID = '00000000-0000-0000-0000-000000000001';

describe('SessionsService', () => {
  let svc: SessionsService;
  let mockCreate: ReturnType<typeof vi.fn>;
  let mockFindFirst: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCreate = vi.fn();
    mockFindFirst = vi.fn();
    mockUpdate = vi.fn();

    const mockPrisma = {
      $queryRawUnsafe: vi.fn(),
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
          session: { create: mockCreate, findFirst: mockFindFirst, update: mockUpdate },
        }),
      ),
      session: { create: mockCreate, findFirst: mockFindFirst, update: mockUpdate },
    };

    // JwtService leve (sem NestJS DI)
    const mockJwt = {
      hashRefreshToken: (t: string) => 'hash_' + t,
      refreshTtlMs: () => 7 * 24 * 60 * 60 * 1000,
      signRefresh: () => 'fresh_refresh_token_64hexchars_here_abcdef0123456789aa',
    };

    svc = new SessionsService(mockPrisma as any, mockJwt as any);
  });

  it('create persiste session com refreshTokenHash derivado do token', async () => {
    const fakeSession = { id: 'sess-1', userId: USER_ID };
    mockCreate.mockResolvedValue(fakeSession);
    const result = await svc.create({
      userId: USER_ID,
      refreshToken: 'mytoken',
      ip: '1.2.3.4',
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refreshTokenHash: 'hash_mytoken' }),
      }),
    );
    expect(result).toEqual(fakeSession);
  });

  it('create inclui expiresAt futuro', async () => {
    mockCreate.mockResolvedValue({ id: 'sess-1' });
    await svc.create({ userId: USER_ID, refreshToken: 'tok', ip: null });
    const callArg = mockCreate.mock.calls[0][0];
    const expiresAt: Date = callArg.data.expiresAt;
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('findActiveByRefreshHash retorna null se session não existe', async () => {
    mockFindFirst.mockResolvedValue(null);
    const result = await svc.findActiveByRefreshHash('nonexistent_hash');
    expect(result).toBeNull();
  });

  it('findActiveByRefreshHash filtra por revokedAt=null e expiresAt>now', async () => {
    const fakeSession = { id: 'sess-1', revokedAt: null };
    mockFindFirst.mockResolvedValue(fakeSession);
    const result = await svc.findActiveByRefreshHash('some_hash');
    expect(result).toEqual(fakeSession);
    // Verifica que o where inclui filtros corretos
    const callArg = mockFindFirst.mock.calls[0][0];
    expect(callArg.where.revokedAt).toBeNull();
    expect(callArg.where.expiresAt).toBeDefined();
  });

  it('revoke seta revokedAt', async () => {
    mockUpdate.mockResolvedValue({ id: 'sess-1', revokedAt: new Date() });
    await svc.revoke('sess-1');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sess-1' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });

  it('rotateRefresh revoga sessão antiga e cria nova', async () => {
    mockUpdate.mockResolvedValue({ id: 'sess-1', revokedAt: new Date() });
    mockCreate.mockResolvedValue({ id: 'sess-2', userId: USER_ID });
    const { refreshToken } = await svc.rotateRefresh('sess-1', { userId: USER_ID });
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(typeof refreshToken).toBe('string');
    expect(refreshToken.length).toBeGreaterThan(0);
  });
});
