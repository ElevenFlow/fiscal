import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { JwtService } from '../src/modules/auth/jwt.service';

const SECRET = 'test-secret-min-32-chars-for-hs256!!';

async function makeGuard() {
  const cfg = {
    get: (k: string) => (k === 'AUTH_JWT_SECRET' ? SECRET : 'test'),
  } as unknown as ConfigService;
  const jwt = new JwtService(cfg);
  jwt.onModuleInit();
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as any;
  return { guard: new AuthGuard(reflector, jwt), jwt, reflector };
}

function makeCtx(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('AuthGuard', () => {
  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    cleanup?.();
    cleanup = null;
  });

  it('@Public() retorna true sem verificar cookie', async () => {
    const { guard, reflector } = await makeGuard();
    reflector.getAllAndOverride.mockReturnValue(true);
    const ctx = makeCtx({ cookies: {}, headers: {} });
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('JWT válido no cookie nf_access → req.auth populado', async () => {
    const { guard, jwt } = await makeGuard();
    const token = await jwt.signAccess({
      userId: 'u1',
      contabilidadeId: null,
      role: 'tenant_user',
    });
    const req: any = { cookies: { nf_access: token }, headers: {} };
    const ctx = makeCtx(req);
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(req.auth?.userId).toBe('u1');
    expect(req.auth?.role).toBe('tenant_user');
  });

  it('JWT válido em Authorization Bearer → req.auth populado', async () => {
    const { guard, jwt } = await makeGuard();
    const token = await jwt.signAccess({
      userId: 'u-bearer',
      contabilidadeId: 'cont-1',
      role: 'tenant_user',
    });
    const req: any = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
    const ctx = makeCtx(req);

    expect(await guard.canActivate(ctx)).toBe(true);
    expect(req.auth).toMatchObject({
      userId: 'u-bearer',
      contabilidadeId: 'cont-1',
      role: 'tenant_user',
    });
  });

  it('cookie nf_access ausente → UnauthorizedException', async () => {
    const { guard } = await makeGuard();
    const ctx = makeCtx({ cookies: {}, headers: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('cookie presente mas token inválido → UnauthorizedException', async () => {
    const { guard } = await makeGuard();
    const ctx = makeCtx({
      cookies: { nf_access: 'invalid.token.here' },
      headers: {},
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('JWT de secret errado → UnauthorizedException', async () => {
    const { guard } = await makeGuard();
    // Token assinado com outro secret
    const cfg2 = {
      get: (k: string) => (k === 'AUTH_JWT_SECRET' ? 'outro-secret-diferente-32chars!!' : 'test'),
    } as unknown as ConfigService;
    const jwt2 = new JwtService(cfg2);
    jwt2.onModuleInit();
    const badToken = await jwt2.signAccess({
      userId: 'attacker',
      contabilidadeId: null,
      role: 'platform_admin',
    });
    const ctx = makeCtx({ cookies: { nf_access: badToken }, headers: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('ALLOW_HEADER_AUTH=true em dev → aceita x-user-id sem cookie', async () => {
    const origAllowHeader = process.env.ALLOW_HEADER_AUTH;
    const origNodeEnv = process.env.NODE_ENV;
    process.env.ALLOW_HEADER_AUTH = 'true';
    process.env.NODE_ENV = 'development';
    cleanup = () => {
      process.env.ALLOW_HEADER_AUTH = origAllowHeader;
      process.env.NODE_ENV = origNodeEnv;
    };

    const { guard } = await makeGuard();
    const req: any = {
      cookies: {},
      headers: { 'x-user-id': 'u2', 'x-role': 'platform_admin' },
    };
    const ctx = makeCtx(req);
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(req.auth?.userId).toBe('u2');
    expect(req.auth?.role).toBe('platform_admin');
  });

  it('ALLOW_HEADER_AUTH=true em prod → NÃO aceita x-user-id (segurança)', async () => {
    const origAllowHeader = process.env.ALLOW_HEADER_AUTH;
    const origNodeEnv = process.env.NODE_ENV;
    process.env.ALLOW_HEADER_AUTH = 'true';
    process.env.NODE_ENV = 'production';
    cleanup = () => {
      process.env.ALLOW_HEADER_AUTH = origAllowHeader;
      process.env.NODE_ENV = origNodeEnv;
    };

    const { guard } = await makeGuard();
    const ctx = makeCtx({
      cookies: {},
      headers: { 'x-user-id': 'attacker', 'x-role': 'platform_admin' },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('x-contabilidade-id é preservado no req.auth via header auth', async () => {
    const origAllowHeader = process.env.ALLOW_HEADER_AUTH;
    const origNodeEnv = process.env.NODE_ENV;
    process.env.ALLOW_HEADER_AUTH = 'true';
    process.env.NODE_ENV = 'development';
    cleanup = () => {
      process.env.ALLOW_HEADER_AUTH = origAllowHeader;
      process.env.NODE_ENV = origNodeEnv;
    };

    const { guard } = await makeGuard();
    const req: any = {
      cookies: {},
      headers: {
        'x-user-id': 'u3',
        'x-role': 'tenant_user',
        'x-contabilidade-id': 'cont-uuid-001',
      },
    };
    const ctx = makeCtx(req);
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(req.auth?.contabilidadeId).toBe('cont-uuid-001');
  });
});
