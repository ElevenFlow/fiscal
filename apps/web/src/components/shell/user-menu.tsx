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
import { Check, LogOut, Settings, User, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useMockRole, useMockUser, useSwitchProfile } from '@/lib/mock-auth';
import type { Role } from '@/lib/mock-data';

/**
 * Menu de usuário no header (Plan 02-09 — Clerk religado).
 *
 * - Logout via `useClerk().signOut()` redireciona para /entrar.
 * - "Ver como…" continua usando mock-auth (protótipo de RBAC visual) até Phase 2
 *   plugar `publicMetadata.role` real do Clerk.
 * - Avatar: iniciais do user Clerk (fallback para mock se sessão indisponível).
 */

const roleLabels: Record<Role, string> = {
  admin: 'Administrador',
  contabilidade: 'Contabilidade',
  empresa: 'Empresa',
};

export function UserMenu() {
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const mockUser = useMockUser();
  const role = useMockRole();
  const switchProfile = useSwitchProfile();
  const [isPending, startTransition] = useTransition();

  const displayName = isLoaded && isSignedIn && clerkUser
    ? clerkUser.fullName || clerkUser.firstName || mockUser.nome
    : mockUser.nome;
  const displayEmail = isLoaded && isSignedIn && clerkUser
    ? clerkUser.primaryEmailAddress?.emailAddress ?? mockUser.email
    : mockUser.email;

  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    startTransition(async () => {
      await signOut();
      router.push('/entrar');
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-2"
          aria-label={`Menu do usuário ${displayName}`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="hidden flex-col items-start leading-none md:flex">
            <span className="text-sm font-medium">{displayName}</span>
            <span className="text-xs text-muted-foreground">{roleLabels[role]}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5 text-sm">
          <div className="font-medium">{displayName}</div>
          <div className="truncate text-xs text-muted-foreground">{displayEmail}</div>
        </div>
        <DropdownMenuSeparator />

        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ver como
        </div>
        {(['admin', 'contabilidade', 'empresa'] as Role[]).map((r) => (
          <DropdownMenuItem key={r} onClick={() => switchProfile(r)}>
            <Users className="mr-2 h-4 w-4" />
            <span className="flex-1">{roleLabels[r]}</span>
            {role === r && <Check className="h-4 w-4 text-brand-blue" />}
          </DropdownMenuItem>
        ))}

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
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isPending}
          className="text-brand-danger"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {isPending ? 'Saindo…' : 'Sair'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
