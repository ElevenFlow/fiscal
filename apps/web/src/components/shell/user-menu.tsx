'use client';

import { useClerk, useUser } from '@clerk/nextjs';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@nexo/ui';
import { LogOut, Settings, User } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

/**
 * Menu de usuário no header (FOUND-13, FOUND-03).
 *
 * Integra com Clerk (Plan 07):
 *  - `useUser()` fornece nome/email/avatar do user autenticado.
 *  - `useClerk().signOut()` encerra sessão e redireciona para /entrar.
 *
 * Fallback: se não há user (antes de hidratação ou erro de rede), renderiza
 * placeholder "Usuário" — o layout já protege a rota, então este estado é breve.
 */
export function UserMenu() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const name = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Usuário';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const avatarUrl = user?.imageUrl ?? null;
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    await signOut();
    router.push('/entrar');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-2"
          aria-label={`Menu do usuário ${name}`}
          disabled={!isLoaded}
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-xs font-semibold text-white">
              {initials}
            </div>
          )}
          <div className="hidden flex-col items-start leading-none md:flex">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{email}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-sm">
          <div className="font-medium">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{email}</div>
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
