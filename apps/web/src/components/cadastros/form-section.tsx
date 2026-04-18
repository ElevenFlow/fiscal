'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@nexo/ui';
import type { ReactNode } from 'react';

export interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Força grid interno em 2 colunas no desktop (default true). */
  twoColumns?: boolean;
  className?: string;
}

/**
 * Seção em Card de formulário de cadastro. Padroniza título + descrição + grid
 * responsivo (2 colunas no desktop, 1 coluna abaixo de md).
 */
export function FormSection({
  title,
  description,
  children,
  twoColumns = true,
  className,
}: FormSectionProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <div className={cn('grid gap-4', twoColumns && 'md:grid-cols-2')}>{children}</div>
      </CardContent>
    </Card>
  );
}
