'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'nexo.sidebar.collapsed';

/**
 * Hook que persiste o estado de colapso da sidebar em localStorage.
 * FOUND-14: sidebar colapsável 240px → 64px com estado persistente entre sessões.
 *
 * O valor inicial renderiza sempre como `false` (expanded) no server e no
 * primeiro paint do client — evita mismatch de hidratação. A leitura do
 * localStorage acontece em useEffect e ajusta o state após o mount.
 */
export function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') setCollapsed(true);
    } catch {
      // localStorage indisponível (ex.: modo privado com storage bloqueado) — mantém default.
    }
    setHydrated(true);
  }, []);

  const update = (v: boolean) => {
    setCollapsed(v);
    if (hydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, String(v));
      } catch {
        // ignora — UI continua funcional mesmo sem persistência
      }
    }
  };

  return [collapsed, update];
}
