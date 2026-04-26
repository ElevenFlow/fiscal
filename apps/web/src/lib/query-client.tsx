'use client';

/**
 * Stub criado pelo Plan 02-09 — Plan 02-07 substituirá com QueryClientProvider real (TanStack Query).
 *
 * O ClerkProvider em layout.tsx referencia AppQueryProvider para já deixar o ponto de extensão
 * pronto. Por ora, é um pass-through.
 */

import type { ReactNode } from 'react';

export function AppQueryProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
