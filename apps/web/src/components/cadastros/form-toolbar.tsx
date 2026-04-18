'use client';

import { Button } from '@nexo/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export interface FormToolbarProps {
  title: string;
  subtitle?: string;
  backHref: string;
  onCancel: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

/**
 * Barra superior do formulário de cadastro:
 * - esquerda: botão Voltar + título da página
 * - direita: Cancelar · Salvar rascunho · Salvar
 */
export function FormToolbar({
  title,
  subtitle,
  backHref,
  onCancel,
  onSaveDraft,
  onSubmit,
  isSubmitting,
  submitLabel = 'Salvar',
}: FormToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar">
          <Link href={backHref}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button variant="outline" onClick={onSaveDraft} disabled={isSubmitting}>
          Salvar rascunho
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : submitLabel}
        </Button>
      </div>
    </div>
  );
}
