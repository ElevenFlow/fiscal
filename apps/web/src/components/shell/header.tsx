'use client';

import { Button, Separator } from '@nexo/ui';
import { Search } from 'lucide-react';
import { CommandPalette } from './command-palette';
import { EmpresaSwitcher } from './empresa-switcher';
import { NotificationBell } from './notification-bell';
import { MobileSidebarTrigger } from './sidebar';
import { UserMenu } from './user-menu';

/**
 * Header superior (FOUND-13):
 * - Trigger do drawer mobile (hamburguer, md:hidden)
 * - Seletor de empresa ativa
 * - Busca global Ctrl+K (botão; atalho global fica no CommandPalette)
 * - Sino de alertas com badge
 * - Menu do usuário
 *
 * O <CommandPalette /> é montado aqui e escuta Ctrl+K em `window`.
 */
export function Header() {
  const openCommandPalette = () => {
    // Dispara evento Ctrl+K programaticamente — reusa o listener do CommandPalette.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <MobileSidebarTrigger />
      <EmpresaSwitcher />

      <div className="flex-1" />

      <Button
        variant="outline"
        className="hidden w-72 justify-start gap-2 text-muted-foreground md:inline-flex"
        onClick={openCommandPalette}
        aria-label="Abrir busca rápida (Ctrl+K)"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left text-sm">Buscar…</span>
        <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
          Ctrl+K
        </kbd>
      </Button>

      <Separator orientation="vertical" className="mx-1 h-8" />

      <NotificationBell />
      <UserMenu />

      <CommandPalette />
    </header>
  );
}
