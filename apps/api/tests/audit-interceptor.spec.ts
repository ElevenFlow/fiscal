import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditInterceptor } from '../src/modules/audit/audit.interceptor';

/**
 * Testa a semântica fire-and-forget (WARNING #8):
 * - audit.record nunca bloqueia o caminho crítico da resposta
 * - audit.record rejeitando nunca swallow success do handler
 * - handler lançando sempre propaga (exceção do audit não substitui)
 */
describe('AuditInterceptor — fire-and-forget semantics', () => {
  let audit: { record: ReturnType<typeof vi.fn> };
  let reflector: { get: ReturnType<typeof vi.fn> };
  let interceptor: AuditInterceptor;
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => ({ ip: '127.0.0.1', headers: {}, params: {}, body: {} }),
    }),
    getHandler: () => () => {},
  } as never;

  beforeEach(() => {
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    reflector = {
      get: vi.fn().mockReturnValue({ action: 'test', resourceType: 'r' }),
    };
    interceptor = new AuditInterceptor(reflector as never, audit as never);
  });

  it('success response reaches caller even if audit.record rejects', async () => {
    audit.record.mockRejectedValueOnce(new Error('audit db down'));
    const handler = { handle: () => of({ id: 'abc' }) };
    const obs = interceptor.intercept(ctx, handler as never);
    const result = await lastValueFrom(obs);
    expect(result).toEqual({ id: 'abc' });
    // Wait for setImmediate to flush
    await new Promise((r) => setImmediate(r));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'success' }),
    );
  });

  it('handler exception is propagated even if audit.record rejects', async () => {
    audit.record.mockRejectedValueOnce(new Error('audit down'));
    const handler = { handle: () => throwError(() => new Error('boom')) };
    const obs = interceptor.intercept(ctx, handler as never);
    await expect(lastValueFrom(obs)).rejects.toThrow('boom');
    await new Promise((r) => setImmediate(r));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'failure' }),
    );
  });

  it('no @Auditable metadata — bypass without calling audit.record', async () => {
    reflector.get.mockReturnValueOnce(undefined);
    const handler = { handle: () => of({ ok: true }) };
    const obs = interceptor.intercept(ctx, handler as never);
    const result = await lastValueFrom(obs);
    expect(result).toEqual({ ok: true });
    await new Promise((r) => setImmediate(r));
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('audit.record is deferred (setImmediate) — not called within current tick', async () => {
    const handler = { handle: () => of({ id: 'x' }) };
    const obs = interceptor.intercept(ctx, handler as never);
    await lastValueFrom(obs);
    // Immediately after response resolves, audit.record should NOT have run yet
    expect(audit.record).not.toHaveBeenCalled();
    await new Promise((r) => setImmediate(r));
    expect(audit.record).toHaveBeenCalledTimes(1);
  });
});
