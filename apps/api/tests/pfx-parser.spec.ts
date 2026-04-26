import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PfxParserService } from '../src/modules/certificados/pfx-parser.service';

/**
 * Suite PfxParserService — parse de PKCS#12 com fixture .pfx auto-assinado
 * gerado em tests/fixtures/test-cert.pfx.
 *
 * Subject do fixture: CN=NEXO TESTE LTDA:11222333000181, O=Nexo Test, C=BR
 * Senha: test1234
 * Validade: 365 dias a partir da geração (não-vencido para a maioria dos cenários)
 */

const FIXTURE_PATH = join(__dirname, 'fixtures', 'test-cert.pfx');
const PASSWORD = 'test1234';

describe('PfxParserService', () => {
  let svc: PfxParserService;
  let pfxBytes: Buffer;

  beforeAll(() => {
    svc = new PfxParserService();
    pfxBytes = readFileSync(FIXTURE_PATH);
  });

  it('parse com senha correta retorna { cn, fingerprint, notBefore, notAfter }', () => {
    const r = svc.parsePfx(pfxBytes, PASSWORD);
    expect(r.cn).toContain('NEXO TESTE');
    expect(r.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(r.notBefore).toBeInstanceOf(Date);
    expect(r.notAfter).toBeInstanceOf(Date);
    expect(r.notAfter.getTime()).toBeGreaterThan(Date.now());
    expect(r.notBefore.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('extractCnpj funciona para subject ICP-Brasil ":14digitos"', () => {
    const r = svc.parsePfx(pfxBytes, PASSWORD);
    expect(r.cnpjCertificado).toBe('11222333000181');
  });

  it('senha errada lança BusinessException com code INVALID_PFX_PASSWORD', () => {
    expect(() => svc.parsePfx(pfxBytes, 'wrongpass')).toThrowError(
      expect.objectContaining({ code: 'INVALID_PFX_PASSWORD' }) as never,
    );
  });

  it('senha vazia lança INVALID_PFX_PASSWORD', () => {
    expect(() => svc.parsePfx(pfxBytes, '')).toThrowError(
      expect.objectContaining({ code: 'INVALID_PFX_PASSWORD' }) as never,
    );
  });

  it('bytes corrompidos lançam INVALID_PFX_FORMAT', () => {
    const garbage = Buffer.from('not a pfx file at all, just random text 1234567890');
    expect(() => svc.parsePfx(garbage, PASSWORD)).toThrowError(
      expect.objectContaining({ code: 'INVALID_PFX_FORMAT' }) as never,
    );
  });

  it('buffer vazio lança INVALID_PFX_FORMAT', () => {
    expect(() => svc.parsePfx(Buffer.alloc(0), PASSWORD)).toThrowError(
      expect.objectContaining({ code: 'INVALID_PFX_FORMAT' }) as never,
    );
  });

  it('fingerprint é SHA-256 64-char hex lowercase determinístico', () => {
    const a = svc.parsePfx(pfxBytes, PASSWORD);
    const b = svc.parsePfx(pfxBytes, PASSWORD);
    expect(a.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(a.fingerprint).toBe(a.fingerprint.toLowerCase());
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('senha do .pfx jamais aparece na mensagem de erro (T-02-04-07)', () => {
    const secretPassword = 'super-secret-pwd-12345';
    try {
      svc.parsePfx(pfxBytes, secretPassword);
      throw new Error('should have thrown');
    } catch (err) {
      const e = err as Error & { code?: string; details?: Record<string, unknown> };
      expect(e.code).toBe('INVALID_PFX_PASSWORD');
      expect(e.message).not.toContain(secretPassword);
      expect(JSON.stringify(e.details ?? {})).not.toContain(secretPassword);
    }
  });
});
