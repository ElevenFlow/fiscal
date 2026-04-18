'use client';

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Role } from './mock-data';

/**
 * MODO PROTÓTIPO — contexto de usuário mock + profile switcher.
 *
 * - Sem auth real. Sem backend. Sem cookies de sessão.
 * - O perfil ativo ("admin" | "contabilidade" | "empresa") é persistido em
 *   localStorage para que o refresh mantenha a visão escolhida.
 * - O nome/email do usuário também mudam conforme o perfil ativo para refletir
 *   uma experiência mais realista nos dashboards.
 */

export type MockUser = {
  id: string;
  nome: string;
  email: string;
  perfil: Role;
  empresaAtivaId?: string;
  contabilidadeId?: string;
};

const STORAGE_KEY = 'nexo:mock:perfil';

const userByRole: Record<Role, MockUser> = {
  empresa: {
    id: 'u-1',
    nome: 'Rodrigo Silva',
    email: 'rodrigo@oliveiratech.com.br',
    perfil: 'empresa',
    empresaAtivaId: 'e-1',
    contabilidadeId: 'c-1',
  },
  contabilidade: {
    id: 'u-2',
    nome: 'Beatriz Prado',
    email: 'beatriz@primegestao.com.br',
    perfil: 'contabilidade',
    contabilidadeId: 'c-1',
  },
  admin: {
    id: 'u-4',
    nome: 'Fernanda Costa',
    email: 'fernanda@nexofiscal.com.br',
    perfil: 'admin',
  },
};

interface MockAuthContextValue {
  user: MockUser;
  role: Role;
  switchProfile: (role: Role) => void;
}

const MockAuthContext = createContext<MockAuthContextValue | null>(null);

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('empresa');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Role | null;
      if (stored && (stored === 'admin' || stored === 'contabilidade' || stored === 'empresa')) {
        setRole(stored);
      }
    } catch {
      // ignora falha de localStorage
    }
    setHydrated(true);
  }, []);

  const switchProfile = useCallback((next: Role) => {
    setRole(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // noop
    }
  }, []);

  const value: MockAuthContextValue = {
    user: userByRole[role],
    role,
    switchProfile,
  };

  // Evita hidratação quebrada: primeira renderização usa o default SSR ('empresa')
  // e, após hidratar, re-renderiza com a escolha persistida.
  return (
    <MockAuthContext.Provider value={value}>
      <span data-mock-hydrated={hydrated ? 'true' : 'false'} style={{ display: 'none' }} />
      {children}
    </MockAuthContext.Provider>
  );
}

export function useMockUser(): MockUser {
  const ctx = useContext(MockAuthContext);
  if (!ctx) {
    // Fallback seguro fora do provider (ex: página pública de /entrar).
    return userByRole.empresa;
  }
  return ctx.user;
}

export function useMockRole(): Role {
  const ctx = useContext(MockAuthContext);
  return ctx?.role ?? 'empresa';
}

export function useSwitchProfile(): (role: Role) => void {
  const ctx = useContext(MockAuthContext);
  return ctx?.switchProfile ?? (() => undefined);
}
