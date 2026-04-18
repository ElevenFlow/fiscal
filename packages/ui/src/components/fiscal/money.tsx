import type * as React from 'react';
import { cn } from '../../lib/cn';

export interface MoneyProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Valor em reais (ex: 1234.56). Passar numero — a formatação aplica BRL automaticamente. */
  value: number;
  /** Número de casas decimais. Default 2 (centavos). */
  decimals?: number;
  /** Se true, mostra sinal negativo em vermelho. Default true. */
  colorNegative?: boolean;
  /** Omite prefixo R$ (ex: em tabelas densas). Default false. */
  hideCurrency?: boolean;
}

/**
 * Formata valores monetários em BRL padrão pt-BR (vírgula decimal, ponto como
 * separador de milhar). Renderiza em font-mono com tabular-nums para alinhamento
 * correto em tabelas de valores fiscais.
 *
 * Ex: <Money value={1234.56} /> → "R$ 1.234,56"
 *     <Money value={-50.00} /> → "-R$ 50,00" (em vermelho)
 */
export function Money({
  value,
  decimals = 2,
  colorNegative = true,
  hideCurrency = false,
  className,
  ...props
}: MoneyProps) {
  const isNegative = value < 0;
  const formatter = new Intl.NumberFormat('pt-BR', {
    style: hideCurrency ? 'decimal' : 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span
      className={cn(
        'font-mono tabular-nums',
        isNegative && colorNegative && 'text-brand-danger',
        className,
      )}
      {...props}
    >
      {formatter.format(value)}
    </span>
  );
}
