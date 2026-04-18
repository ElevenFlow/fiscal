'use client';

import { cn } from '@nexo/ui';
import type { ReactNode } from 'react';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Campo de formulário padrão: label, input/área de controle e mensagem de erro.
 * Mantém ritmo vertical consistente entre todas as telas de cadastro.
 */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required ? <span className="ml-0.5 text-brand-danger">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-brand-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
