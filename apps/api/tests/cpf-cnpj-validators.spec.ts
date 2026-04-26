import { describe, expect, it } from 'vitest';
import {
  cnpjValidatedSchema,
  cpfCnpjValidatedSchema,
  isValidCnpj,
  isValidCpf,
} from '@nexo/shared';

/**
 * Suite Plan 02-03 Task 1 — Validação CPF/CNPJ (CAD-08).
 *
 * Cobertura mínima: ≥ 50 cenários
 *  - CNPJs válidos (com e sem máscara) — 8+
 *  - CPFs válidos (com e sem máscara) — 4+
 *  - CNPJs inválidos (1 dígito errado, repetidos, comprimento errado) — 9+
 *  - CPFs inválidos (1 dígito errado, repetidos, comprimento errado) — 8+
 *  - Edge cases (vazio, símbolos, caracteres não numéricos) — 5+
 *  - cpfCnpjValidatedSchema — 6+
 *  - cnpjValidatedSchema — 4+
 *  - Repetidos exaustivos (00..99) — 10
 *
 * Total: ≥ 54 testes individuais (it.each conta como N).
 *
 * Nota: validadores vivem em packages/shared/src/cadastros/common.ts (Plan 02-02 Task 1).
 * Esta suite garante invariância pré/pós refator e documenta os exemplos públicos
 * (Receita Federal, Itaú, etc.) usados para gerar fixtures.
 */

// ============================================================================
// CNPJs válidos — exemplos públicos + computados manualmente
// ============================================================================
const validCnpjs = [
  '11.222.333/0001-81', // dígito verificador padrão de teste
  '11222333000181',
  '00.000.000/0001-91',
  '00000000000191',
  '34.028.316/0001-03', // Receita Federal (público)
  '34028316000103',
  '60.701.190/0001-04', // Itaú (público)
  '60701190000104',
  '33.000.167/0001-01', // Petrobras (público)
  '33000167000101',
];

// CNPJs inválidos: um dígito errado em CNPJs conhecidamente válidos
const invalidCnpjsByDigit = [
  '11.222.333/0001-82', // dígito 13 errado
  '11222333000182',
  '34.028.316/0001-04', // Receita Federal com dígito alterado
  '34028316000104',
  '60.701.190/0001-05',
  '60701190000105',
  '00.000.000/0001-92',
  '00000000000192',
];

// CNPJs inválidos: comprimento ou caracteres
const invalidCnpjsByShape = [
  '1122233300018', // 13 dígitos
  '112223330001811', // 15 dígitos
  '', // vazio
  'abc.def.ghi/jklm-no', // só letras
  'CNPJ', // texto curto
];

// CPFs válidos — exemplos públicos
const validCpfs = [
  '111.444.777-35',
  '11144477735',
  '529.982.247-25', // exemplo público comumente usado
  '52998224725',
  '987.654.321-00', // computado: 987654321 → DV 00
  '98765432100',
];

// CPFs inválidos por dígito
const invalidCpfsByDigit = [
  '111.444.777-36',
  '11144477736',
  '529.982.247-26',
  '52998224726',
  '12345678900',
  '12345678910',
];

// CPFs inválidos por shape
const invalidCpfsByShape = [
  '1114447773', // 10 dígitos
  '111444777355', // 12 dígitos
  '', // vazio
  'abc.def.ghi-jk',
];

// CPFs/CNPJs com todos os dígitos repetidos — devem falhar (regra Receita)
const repeatedDigitCpfs = [
  '00000000000',
  '11111111111',
  '22222222222',
  '33333333333',
  '44444444444',
  '55555555555',
  '66666666666',
  '77777777777',
  '88888888888',
  '99999999999',
];
const repeatedDigitCnpjs = [
  '00000000000000',
  '11111111111111',
  '22222222222222',
  '99999999999999',
];

describe('CPF/CNPJ validators (CAD-08)', () => {
  // --------------------------------------------------------------------------
  describe('isValidCnpj', () => {
    it.each(validCnpjs)('aceita CNPJ válido: %s', (cnpj) => {
      expect(isValidCnpj(cnpj)).toBe(true);
    });

    it.each(invalidCnpjsByDigit)('rejeita CNPJ com dígito errado: %s', (cnpj) => {
      expect(isValidCnpj(cnpj)).toBe(false);
    });

    it.each(invalidCnpjsByShape)('rejeita CNPJ com shape inválido: %s', (cnpj) => {
      expect(isValidCnpj(cnpj)).toBe(false);
    });

    it.each(repeatedDigitCnpjs)('rejeita CNPJ com dígitos repetidos: %s', (cnpj) => {
      expect(isValidCnpj(cnpj)).toBe(false);
    });

    it('aceita CNPJ com espaços extras', () => {
      expect(isValidCnpj(' 11.222.333/0001-81 ')).toBe(true);
    });

    it('aceita CNPJ com mistura de máscara', () => {
      // Aceita qualquer separador: o validator strip-mask via /\D/g
      expect(isValidCnpj('11-222-333-0001-81')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  describe('isValidCpf', () => {
    it.each(validCpfs)('aceita CPF válido: %s', (cpf) => {
      expect(isValidCpf(cpf)).toBe(true);
    });

    it.each(invalidCpfsByDigit)('rejeita CPF com dígito errado: %s', (cpf) => {
      expect(isValidCpf(cpf)).toBe(false);
    });

    it.each(invalidCpfsByShape)('rejeita CPF com shape inválido: %s', (cpf) => {
      expect(isValidCpf(cpf)).toBe(false);
    });

    it.each(repeatedDigitCpfs)('rejeita CPF com dígitos repetidos: %s', (cpf) => {
      expect(isValidCpf(cpf)).toBe(false);
    });

    it('aceita CPF com espaços', () => {
      expect(isValidCpf(' 111.444.777-35 ')).toBe(true);
    });

    it('rejeita CPF que parece CNPJ (14 dígitos)', () => {
      expect(isValidCpf('11222333000181')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  describe('cpfCnpjValidatedSchema', () => {
    it('aceita CNPJ válido com máscara, normaliza para apenas dígitos', () => {
      const r = cpfCnpjValidatedSchema.safeParse('11.222.333/0001-81');
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toBe('11222333000181');
    });

    it('aceita CPF válido com máscara, normaliza', () => {
      const r = cpfCnpjValidatedSchema.safeParse('111.444.777-35');
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toBe('11144477735');
    });

    it('rejeita string vazia', () => {
      expect(cpfCnpjValidatedSchema.safeParse('').success).toBe(false);
    });

    it('rejeita 12 dígitos (nem CPF nem CNPJ)', () => {
      expect(cpfCnpjValidatedSchema.safeParse('123456789012').success).toBe(false);
    });

    it('rejeita 13 dígitos', () => {
      expect(cpfCnpjValidatedSchema.safeParse('1234567890123').success).toBe(false);
    });

    it('rejeita CNPJ com dígito verificador errado', () => {
      expect(cpfCnpjValidatedSchema.safeParse('11.222.333/0001-82').success).toBe(false);
    });

    it('rejeita CPF com dígito errado', () => {
      expect(cpfCnpjValidatedSchema.safeParse('111.444.777-36').success).toBe(false);
    });

    it('rejeita CPF com 11 zeros', () => {
      expect(cpfCnpjValidatedSchema.safeParse('00000000000').success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  describe('cnpjValidatedSchema', () => {
    it('aceita CNPJ válido', () => {
      const r = cnpjValidatedSchema.safeParse('11.222.333/0001-81');
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toBe('11222333000181');
    });

    it('rejeita CPF (11 dígitos) — schema é específico para CNPJ', () => {
      expect(cnpjValidatedSchema.safeParse('11144477735').success).toBe(false);
    });

    it('rejeita CNPJ com dígito errado', () => {
      expect(cnpjValidatedSchema.safeParse('11222333000182').success).toBe(false);
    });

    it('rejeita CNPJ com dígitos repetidos', () => {
      expect(cnpjValidatedSchema.safeParse('11111111111111').success).toBe(false);
    });
  });
});
