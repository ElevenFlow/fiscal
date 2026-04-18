import { describe, it, expect } from 'vitest';
import { safeLog, ALLOWED_LOG_KEYS } from '../src/logger/safe-log';

describe('safeLog — whitelist', () => {
  it('keeps whitelisted keys as-is', () => {
    const out = safeLog({ tenantId: 'uuid', userId: 'u1', action: 'x' });
    expect(out).toEqual({ tenantId: 'uuid', userId: 'u1', action: 'x' });
  });

  it('omits non-whitelisted keys as [OMITTED]', () => {
    const out = safeLog({ userId: 'u1', cpf: '111.222.333-44', password: 'secret' });
    expect(out.userId).toBe('u1');
    expect(out.cpf).toBe('[OMITTED]');
    expect(out.password).toBe('[OMITTED]');
  });

  it('ALLOWED_LOG_KEYS contains tenantId/userId/action', () => {
    expect(ALLOWED_LOG_KEYS.has('tenantId')).toBe(true);
    expect(ALLOWED_LOG_KEYS.has('userId')).toBe(true);
    expect(ALLOWED_LOG_KEYS.has('action')).toBe(true);
    // Sanity: PII keys are NOT in whitelist
    expect(ALLOWED_LOG_KEYS.has('cpf')).toBe(false);
    expect(ALLOWED_LOG_KEYS.has('password')).toBe(false);
  });

  it('preserves shape by not removing keys (SIEM consistency)', () => {
    const out = safeLog({ userId: 'u1', cpf: '123' });
    expect(Object.keys(out).sort()).toEqual(['cpf', 'userId']);
  });
});
