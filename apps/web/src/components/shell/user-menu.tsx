'use client';

import { logoutAction } from '@/app/entrar/actions';
import { useMockRole, useMockUser, useSwitchProfile } from '@/lib/mock-auth';
import type { Role } from '@/lib/mock-data';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@nexo/ui';
import { Check, LogOut, Settings, User, Users } from 'lucide-react';
import { useTransition } from 'react';

/**
 * Menu de usuário no header + seletor de perfil (MODO PROTÓTIPO).
 *
 * - `useMockUser()` fornece nome/email do usuário fake conforme perfil ativo.
 * - `useSwitchProfile()` troca entre admin/contabilidade/empresa e persiste em
 *   localStorage. O re-render derivado atualiza sidebar/dashboards.
 * - "Sair" apenas redireciona para /entrar (não há sessão real).
 */

const roleLabels: Record<Role, string> = {
  admin: 'Administrador',
  contabilidade: 'Contabilidade',
  empresa: 'Empresa',
};

export function UserMenu() {
  const user = useMockUser();
  const role = useMockRole();
  const switchProfile = useSwitchProfile();
  const [isPending, startTransition] = useTransition();

  const initials = user.nome
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    startTransition(() => {
      void logoutAction();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-2"
          aria-label={`Menu do usuário ${user.nome}`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="hidden flex-col items-start leading-none md:flex">
            <span className="text-sm font-medium">{user.nome}</span>
            <span className="text-xs text-muted-foreground">{roleLabels[role]}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5 text-sm">
          <div className="font-medium">{user.nome}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
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
