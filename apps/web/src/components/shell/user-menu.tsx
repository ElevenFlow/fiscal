'use client';

import { mockUser } from '@/lib/mock-data';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@nexo/ui';
import { LogOut, Settings, User } from 'lucide-react';

/**
 * Menu de usuário no header (FOUND-13).
 *
 * Plan 07 (Clerk) substitui `mockUser` por `useUser()` do Clerk e pluga
 * `signOut()` no handler de logout.
 */
export function UserMenu() {
  const initials = mockUser.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    // TODO Plan 07: chamar Clerk.signOut() + redirecionar para /entrar.
    // Placeholder intencional enquanto Clerk não está plugado — sem efeito visível ao usuário.
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-2"
          aria-label={`Menu do usuário ${mockUser.name}`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="hidden flex-col items-start leading-none md:flex">
            <span className="text-sm font-medium">{mockUser.name}</span>
            <span className="text-xs text-muted-foreground">{mockUser.email}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-sm">
          <div className="font-medium">{mockUser.name}</div>
          <div className="truncate text-xs text-muted-foreground">{mockUser.email}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          Perfil
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          Preferências
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-brand-danger">
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
