import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * Parâmetros argon2id seguindo NIST SP 800-63b (m=64MB, t=3, p=4).
 * Constante imutável — alteração requer security review (T-02.1-02-02).
 */
const ARGON2_OPTIONS = {
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
} as const;

/**
 * PasswordService — hash e verificação de senhas com argon2id.
 *
 * SEGURANÇA:
 * - Nunca armazena senha em claro; hash argon2id contém salt embutido.
 * - verify() é constant-time (argon2 garante via timing-safe compare interno).
 * - verify() nunca lança para hash inválido — retorna false (T-02.1-02-02).
 */
@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(storedHash: string, password: string): Promise<boolean> {
    try {
      return await verify(storedHash, password, ARGON2_OPTIONS);
    } catch {
      // Hash inválido (não argon2id, truncado, corrompido) → false sem throw
      return false;
    }
  }
}
