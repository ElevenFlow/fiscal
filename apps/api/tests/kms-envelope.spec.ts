import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { KmsEnvelopeService } from '../src/modules/storage/kms-envelope.service';

/**
 * Suite KmsEnvelopeService — round-trip + tamper detection do envelope encryption.
 * Roda em modo dev fallback (DEV_MASTER_KEY) — não exige AWS KMS.
 *
 * Cobre threats T-02-04-04 (context tampering) e T-02-04-12 (fail-closed em prod).
 */
describe('KmsEnvelopeService — dev fallback', () => {
  let svc: KmsEnvelopeService;
  const originalEnv = { ...process.env };

  beforeAll(() => {
    process.env.KMS_CERT_KEY_ID = '';
    process.env.DEV_MASTER_KEY = randomBytes(32).toString('hex');
    process.env.NODE_ENV = 'development';
    svc = new KmsEnvelopeService();
    svc.onModuleInit();
  });

  afterAll(() => {
    process.env.KMS_CERT_KEY_ID = originalEnv.KMS_CERT_KEY_ID;
    process.env.DEV_MASTER_KEY = originalEnv.DEV_MASTER_KEY;
    process.env.NODE_ENV = originalEnv.NODE_ENV;
  });

  it('round-trip: decrypt(encrypt(p)) === p', async () => {
    const plain = Buffer.from('teste 12345 pfx fake');
    const ctx = {
      tenantId: '33333333-3333-3333-3333-333333333333',
      purpose: 'pfx' as const,
    };
    const env = await svc.encryptEnvelope(plain, ctx);
    expect(env.ciphertext).not.toEqual(plain);
    expect(env.ciphertext.length).toBeGreaterThanOrEqual(plain.length + 28);
    expect(env.kmsKeyId).toBe('dev-fallback');
    expect(env.encryptedDek.length).toBe(32);

    const back = await svc.decryptEnvelope(env.ciphertext, env.encryptedDek, ctx);
    expect(back.toString()).toBe('teste 12345 pfx fake');
  });

  it('round-trip funciona com payload grande (~80KB) — caso real do .pfx', async () => {
    const plain = randomBytes(80 * 1024);
    const ctx = {
      tenantId: '33333333-3333-3333-3333-333333333333',
      purpose: 'pfx' as const,
    };
    const env = await svc.encryptEnvelope(plain, ctx);
    const back = await svc.decryptEnvelope(env.ciphertext, env.encryptedDek, ctx);
    expect(back.equals(plain)).toBe(true);
  });

  it('encryption context diferente — decrypt rejeita (DEK derivada não bate)', async () => {
    const plain = Buffer.from('secret');
    const ctxA = {
      tenantId: '33333333-3333-3333-3333-333333333333',
      purpose: 'pfx' as const,
    };
    const ctxB = {
      tenantId: '44444444-4444-4444-4444-444444444444',
      purpose: 'pfx' as const,
    };
    const env = await svc.encryptEnvelope(plain, ctxA);
    await expect(
      svc.decryptEnvelope(env.ciphertext, env.encryptedDek, ctxB),
    ).rejects.toThrow();
  });

  it('purpose != pfx é rejeitado (code INVALID_ENCRYPTION_CONTEXT)', async () => {
    const plain = Buffer.from('x');
    await expect(
      svc.encryptEnvelope(plain, {
        tenantId: '33333333-3333-3333-3333-333333333333',
        purpose: 'other' as 'pfx',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ENCRYPTION_CONTEXT' });
  });

  it('tenantId vazio é rejeitado (code INVALID_ENCRYPTION_CONTEXT)', async () => {
    const plain = Buffer.from('x');
    await expect(
      svc.encryptEnvelope(plain, { tenantId: '', purpose: 'pfx' }),
    ).rejects.toMatchObject({ code: 'INVALID_ENCRYPTION_CONTEXT' });
  });

  it('ciphertext truncado é rejeitado', async () => {
    const plain = Buffer.from('hello');
    const ctx = {
      tenantId: '33333333-3333-3333-3333-333333333333',
      purpose: 'pfx' as const,
    };
    const env = await svc.encryptEnvelope(plain, ctx);
    const truncated = env.ciphertext.subarray(0, 10);
    await expect(
      svc.decryptEnvelope(truncated, env.encryptedDek, ctx),
    ).rejects.toThrow();
  });

  it('encryptedDek modificada — falha (auth tag inválido em decrypt)', async () => {
    const plain = Buffer.from('integrity test');
    const ctx = {
      tenantId: '33333333-3333-3333-3333-333333333333',
      purpose: 'pfx' as const,
    };
    const env = await svc.encryptEnvelope(plain, ctx);
    const tampered = Buffer.from(env.encryptedDek);
    tampered[0] ^= 0xff;
    await expect(
      svc.decryptEnvelope(env.ciphertext, tampered, ctx),
    ).rejects.toThrow();
  });

  it('ciphertext modificado (tag corrompida) — falha em decrypt', async () => {
    const plain = Buffer.from('integrity test 2');
    const ctx = {
      tenantId: '33333333-3333-3333-3333-333333333333',
      purpose: 'pfx' as const,
    };
    const env = await svc.encryptEnvelope(plain, ctx);
    const tampered = Buffer.from(env.ciphertext);
    // Flipa um bit no payload do ciphertext (byte 30 — dentro do CT, fora de IV/tag)
    tampered[30] ^= 0xff;
    await expect(
      svc.decryptEnvelope(tampered, env.encryptedDek, ctx),
    ).rejects.toThrow();
  });

  it('encryptEnvelope retorna ciphertexts diferentes para o mesmo plaintext (IV aleatório)', async () => {
    const plain = Buffer.from('determinism check');
    const ctx = {
      tenantId: '33333333-3333-3333-3333-333333333333',
      purpose: 'pfx' as const,
    };
    const a = await svc.encryptEnvelope(plain, ctx);
    const b = await svc.encryptEnvelope(plain, ctx);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
    expect(a.encryptedDek.equals(b.encryptedDek)).toBe(false);
  });
});

describe('KmsEnvelopeService — fail-closed em produção', () => {
  const originalEnv = { ...process.env };

  afterAll(() => {
    process.env.KMS_CERT_KEY_ID = originalEnv.KMS_CERT_KEY_ID;
    process.env.DEV_MASTER_KEY = originalEnv.DEV_MASTER_KEY;
    process.env.NODE_ENV = originalEnv.NODE_ENV;
  });

  it('NODE_ENV=production sem KMS_CERT_KEY_ID — onModuleInit lança', () => {
    process.env.KMS_CERT_KEY_ID = '';
    process.env.DEV_MASTER_KEY = '';
    process.env.NODE_ENV = 'production';
    const svc = new KmsEnvelopeService();
    expect(() => svc.onModuleInit()).toThrowError(/KMS_CERT_KEY_ID is required/);
  });

  it('NODE_ENV=staging sem KMS_CERT_KEY_ID — onModuleInit lança', () => {
    process.env.KMS_CERT_KEY_ID = '';
    process.env.DEV_MASTER_KEY = '';
    process.env.NODE_ENV = 'staging';
    const svc = new KmsEnvelopeService();
    expect(() => svc.onModuleInit()).toThrowError(/KMS_CERT_KEY_ID is required/);
  });

  it('NODE_ENV=development sem KMS_CERT_KEY_ID nem DEV_MASTER_KEY — boot OK mas encrypt falha', async () => {
    process.env.KMS_CERT_KEY_ID = '';
    process.env.DEV_MASTER_KEY = '';
    process.env.NODE_ENV = 'development';
    const svc = new KmsEnvelopeService();
    expect(() => svc.onModuleInit()).not.toThrow();
    await expect(
      svc.encryptEnvelope(Buffer.from('x'), {
        tenantId: '33333333-3333-3333-3333-333333333333',
        purpose: 'pfx',
      }),
    ).rejects.toMatchObject({ code: 'KMS_NOT_CONFIGURED' });
  });
});
