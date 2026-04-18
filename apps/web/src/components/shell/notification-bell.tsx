'use client';

import { mockNotifications } from '@/lib/mock-data';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from '@nexo/ui';
import { Bell } from 'lucide-react';

/**
 * Sino de alertas no header (FOUND-13).
 * Badge numérico com contagem de alertas críticos não-resolvidos (9+ para overflow).
 *
 * Em Phase 6, a origem dos alertas vira stream SSE por tenant ativo.
 */
export function NotificationBell() {
  const { criticalCount, items } = mockNotifications;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Alertas${criticalCount > 0 ? ` (${criticalCount} críticos)` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {criticalCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-danger text-[10px] font-bold text-white">
              {criticalCount > 9 ? '9+' : criticalCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5 text-sm font-semibold">
          <span>Alertas</span>
          <span className="text-xs font-normal text-muted-foreground">{items.length} recentes</span>
        </div>
        <DropdownMenuSeparator />
        {items.map((n) => (
          <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 py-2">
            <div className="flex w-full items-start gap-2">
              <span
                className={cn(
                  'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                  n.severity === 'critical' && 'bg-brand-danger',
                  n.severity === 'warning' && 'bg-brand-warning',
                  n.severity === 'info' && 'bg-brand-info',
                )}
                aria-hidden="true"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">{n.title}</div>
                <div className="text-xs text-muted-foreground">{n.time}</div>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-center text-brand-blue">Ver todos</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
