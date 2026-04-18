'use client';

import { cn } from '@nexo/ui';
import { forwardRef } from 'react';

export const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

export type UF = (typeof UFS)[number];

export interface UfSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

export const UfSelect = forwardRef<HTMLSelectElement, UfSelectProps>(
  ({ className, value, onChange, placeholder = 'UF', ...rest }, ref) => {
    return (
      <select
        ref={ref}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...rest}
      >
        <option value="">{placeholder}</option>
        {UFS.map((uf) => (
          <option key={uf} value={uf}>
            {uf}
          </option>
        ))}
      </select>
    );
  },
);
UfSelect.displayName = 'UfSelect';
