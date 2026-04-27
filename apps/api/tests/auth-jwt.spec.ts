import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '../src/modules/auth/jwt.service';

const SECRET = 'test-secret-min-32-chars-for-hs256-nexo';

function makeJwt() {
  const config = {
    get: (key: string) => (key === 'AUTH_JWT_SECRET' ? SECRET : 'test'),
  } as unknown as ConfigService;
  const svc = new JwtService(config);
  svc.onModuleInit();
  return svc;
}

describe('JwtService', () => {
  let svc: JwtService;
  beforeEach(() => {
    svc = makeJwt();
  });

  it('signAccess + verifyAccess round-trip', async () => {
    const token = await svc.signAccess({
      userId: 'u1',
      contabilidadeId: null,
      role: 'tenant_user',
    });
    const p = await svc.verifyAccess(token);
    expect(p?.userId).toBe('u1');
    expect(p?.role).toBe('tenant_user');
    expect(p?.contabilidadeId).toBeNull();
  });

  it('verifyAccess retorna null para token expirado', async () => {
    // Token forjado com exp no passado — José rejeita com JWTExpired
    const expired = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsImV4cCI6MX0.invalid';
    expect(await svc.verifyAccess(expired)).toBeNull();
  });

  it('verifyAccess retorna null para secret errado', async () => {
    const token = await svc.signAccess({
      userId: 'u1',
      contabilidadeId: null,
      role: 'tenant_user',
    });
    const config2 = {
      get: (k: string) =>
        k === 'AUTH_JWT_SECRET' ? 'outro-secret-min-32-chars-diferente!!' : 'test',
    } as unknown as ConfigService;
    const svc2 = new JwtService(config2);
    svc2.onModuleInit();
    expect(await svc2.verifyAccess(token)).toBeNull();
  });

  it('verifyAccess retorna null para token malformado', async () => {
    expect(await svc.verifyAccess('nao.e.um.jwt')).toBeNull();
    expect(await svc.verifyAccess('')).toBeNull();
  });

  it('signRefresh retorna hex 64 chars', () => {
    const token = svc.signRefresh();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('signRefresh gera tokens únicos a cada chamada', () => {
    const t1 = svc.signRefresh();
    const t2 = svc.signRefresh();
    expect(t1).not.toBe(t2);
  });

  it('hashRefreshToken retorna sha256 hex 64 chars', () => {
    const h = svc.hashRefreshToken('abc');
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashRefreshToken é determinístico para mesma entrada', () => {
    const h1 = svc.hashRefreshToken('token123');
    const h2 = svc.hashRefreshToken('token123');
    expect(h1).toBe(h2);
  });

  it('verifyAccess preserva contabilidadeId no payload', async () => {
    const token = await svc.signAccess({
      userId: 'u2',
      contabilidadeId: 'cont-abc',
      role: 'platform_admin',
    });
    const p = await svc.verifyAccess(token);
    expect(p?.contabilidadeId).toBe('cont-abc');
    expect(p?.role).toBe('platform_admin');
  });
});
