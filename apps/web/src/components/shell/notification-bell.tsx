'use client';

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
import { useEffect, useMemo, useState } from 'react';

type HeaderAlerta = {
  id: string;
  severidade: 'critico' | 'atencao' | 'info';
  titulo: string;
  createdAt: string;
};

export function NotificationBell() {
  const [items, setItems] = useState<HeaderAlerta[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/alertas?status=aberto', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((payload) => {
        if (active && Array.isArray(payload)) setItems(payload.slice(0, 5));
      })
      .catch(() => {
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const criticalCount = useMemo(
    () => items.filter((item) => item.severidade === 'critico').length,
    [items],
  );

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
          {criticalCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-danger text-[10px] font-bold text-white">
              {criticalCount > 9 ? '9+' : criticalCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5 text-sm font-semibold">
          <span>Alertas</span>
          <span className="text-xs font-normal text-muted-foreground">{items.length} recentes</span>
        </div>
        <DropdownMenuSeparator />
        {items.map((alerta) => (
          <DropdownMenuItem
            key={alerta.id}
            className="flex flex-col items-start gap-1 py-2"
            onSelect={() => {
              window.location.href = '/alertas';
            }}
          >
            <div className="flex w-full items-start gap-2">
              <span
                className={cn(
                  'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                  alerta.severidade === 'critico' && 'bg-brand-danger',
                  alerta.severidade === 'atencao' && 'bg-brand-warning',
                  alerta.severidade === 'info' && 'bg-brand-info',
                )}
                aria-hidden="true"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">{alerta.titulo}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(alerta.createdAt).toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
        {items.length === 0 ? (
          <DropdownMenuItem className="justify-center text-muted-foreground">
            Nenhum alerta aberto
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="justify-center text-brand-blue"
          onSelect={() => {
            window.location.href = '/alertas';
          }}
        >
          Ver todos
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
