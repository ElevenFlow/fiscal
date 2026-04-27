import { describe, it, expect } from 'vitest';
import { PasswordService } from '../src/modules/auth/password.service';

describe('PasswordService', () => {
  const svc = new PasswordService();

  it('hash retorna string argon2id válida', async () => {
    const h = await svc.hash('SenhaSegura123!');
    expect(h).toMatch(/^\$argon2id\$/);
  });

  it('verify retorna true para senha correta', async () => {
    const h = await svc.hash('SenhaSegura123!');
    expect(await svc.verify(h, 'SenhaSegura123!')).toBe(true);
  });

  it('verify retorna false para senha errada', async () => {
    const h = await svc.hash('SenhaSegura123!');
    expect(await svc.verify(h, 'SenhaErrada999!')).toBe(false);
  });

  it('verify retorna false para hash inválido sem throw', async () => {
    expect(await svc.verify('hash-invalido-nao-argon2', 'qualquer')).toBe(false);
  });

  it('hash usa params argon2id corretos (memoryCost 65536, timeCost 3)', async () => {
    const h = await svc.hash('TestParam123!');
    // argon2id hash encoda os params no formato: $argon2id$v=19$m=65536,t=3,p=4$...
    expect(h).toMatch(/m=65536/);
    expect(h).toMatch(/t=3/);
    expect(h).toMatch(/p=4/);
  });
});
