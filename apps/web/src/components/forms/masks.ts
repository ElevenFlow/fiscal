/**
 * Máscaras brasileiras para uso em inputs controlados.
 *
 * Todas aceitam string livre e retornam a string já formatada até o máximo de
 * dígitos do padrão. Não bloqueiam digitação parcial — usamos no `onChange`
 * para reformatar o valor enquanto o usuário digita.
 */

const onlyDigits = (value: string) => value.replace(/\D+/g, '');

export function maskCNPJ(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function maskCPF(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function maskCEP(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function maskPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Máscara BRL livre (não assume 2 casas). Aceita "1.234,56". */
export function maskBRL(value: string): string {
  const digits = onlyDigits(value);
  if (!digits) return '';
  const cents = digits.padStart(3, '0');
  const whole = cents.slice(0, -2).replace(/^0+/, '') || '0';
  const frac = cents.slice(-2);
  const withThousands = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withThousands},${frac}`;
}

export function unmaskDigits(value: string): string {
  return onlyDigits(value);
}

/** Converte valor BRL mascarado em número (12,50 → 12.5). */
export function brlToNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Formata número para string BRL com vírgula e separador de milhar. */
export function numberToBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
