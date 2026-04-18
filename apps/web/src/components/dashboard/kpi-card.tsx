'use client';

import { Card, CardContent, cn } from '@nexo/ui';
import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp } from 'lucide-react';

export interface KpiCardProps {
  label: string;
  value: string;
  /** Ícone à esquerda. */
  icon: LucideIcon;
  /** Variação percentual (pode ser negativa). Ex: 12.5 → "+12,5%". */
  variation?: number;
  /** Cor de fundo pastel do ícone. */
  tone?: 'blue' | 'green' | 'amber' | 'red';
  /** Texto explicativo da variação (ex: "vs. mês anterior"). */
  hint?: string;
}

const toneStyles: Record<NonNullable<KpiCardProps['tone']>, string> = {
  blue: 'bg-brand-blue/10 text-brand-blue',
  green: 'bg-brand-green/10 text-brand-green',
  amber: 'bg-brand-warning/10 text-brand-warning',
  red: 'bg-brand-danger/10 text-brand-danger',
};

/**
 * KPI card padrão dos dashboards — ícone pastel à esquerda, label em cinza,
 * valor grande em baixo, variação opcional em verde/vermelho.
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  variation,
  tone = 'blue',
  hint,
}: KpiCardProps) {
  const variationPositive = (variation ?? 0) >= 0;
  const variationText =
    variation !== undefined
      ? `${variationPositive ? '+' : ''}${variation.toLocaleString('pt-BR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}%`
      : null;

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
            toneStyles[tone],
          )}
          aria-hidden="true"
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums tracking-tight">
            {value}
          </div>
          {variationText && (
            <div
              className={cn(
                'mt-1 flex items-center gap-1 text-xs font-medium',
                variationPositive ? 'text-brand-green' : 'text-brand-danger',
              )}
            >
              {variationPositive ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              <span>{variationText}</span>
              {hint && <span className="text-muted-foreground">· {hint}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
