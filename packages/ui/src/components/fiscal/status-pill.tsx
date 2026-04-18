import type * as React from 'react';
import { cn } from '../../lib/cn';

export type FiscalStatus =
  | 'autorizada'
  | 'rejeitada'
  | 'cancelada'
  | 'pendente'
  | 'processando'
  | 'rascunho';

const statusLabels: Record<FiscalStatus, string> = {
  autorizada: 'Autorizada',
  rejeitada: 'Rejeitada',
  cancelada: 'Cancelada',
  pendente: 'Pendente',
  processando: 'Processando',
  rascunho: 'Rascunho',
};

const statusStyles: Record<FiscalStatus, string> = {
  autorizada: 'bg-status-autorizada/10 text-status-autorizada border-status-autorizada/20',
  rejeitada: 'bg-status-rejeitada/10 text-status-rejeitada border-status-rejeitada/20',
  cancelada: 'bg-status-cancelada/10 text-status-cancelada border-status-cancelada/20',
  pendente: 'bg-status-pendente/10 text-status-pendente border-status-pendente/20',
  processando: 'bg-status-processando/10 text-status-processando border-status-processando/20',
  rascunho: 'bg-status-rascunho/10 text-status-rascunho border-status-rascunho/20',
};

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: FiscalStatus;
  /** Sobrescreve o rótulo default (ex: "Autorizada em 14:32"). */
  label?: string;
}

/**
 * Pill de status fiscal padronizada. Cores alinhadas com briefing:
 * verde = autorizada, vermelho = rejeitada, cinza = cancelada,
 * amarelo = pendente, azul = processando.
 *
 * Ex: <StatusPill status="autorizada" />
 *     <StatusPill status="rejeitada" label="Rejeitada (611)" />
 */
export function StatusPill({ status, label, className, ...props }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        statusStyles[status],
        className,
      )}
      {...props}
    >
      <span
        className="mr-1.5 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: 'currentColor' }}
        aria-hidden
      />
      {label ?? statusLabels[status]}
    </span>
  );
}
