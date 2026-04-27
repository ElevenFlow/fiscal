'use client';

/**
 * AppQueryProvider — wrapper TanStack Query 5.x para apps/web (Plan 02-07).
 *
 * Substitui o stub criado no Plan 02-09. Configurações:
 *  - staleTime 30s: dados fiscais costumam mudar pouco; evita refetch agressivo entre re-mounts.
 *  - refetchOnWindowFocus false: usuário trocando de aba não dispara N requests.
 *  - retry 1: transient error tenta uma vez; 4xx propaga rapidamente.
 *
 * Mounted em apps/web/src/app/layout.tsx (sem ClerkProvider — Plan 02.1-03).
 *
 * Convenção de queryKeys: ['{resource}', filtersOrId?]
 *  - ['clientes']                       lista padrão
 *  - ['clientes', { page, search }]    lista com filtros
 *  - ['cliente', id]                   detalhe
 *  - ['certificados']                   lista
 *  - ['series']                         lista
 *  - ['empresas-minhas']                EmpresaSwitcher
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function AppQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
