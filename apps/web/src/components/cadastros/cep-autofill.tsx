'use client';

/**
 * useCepAutofill — Plan 02-07 Task 2.
 *
 * Hook que observa um CEP controlado, debounce 500ms, ao completar 8 dígitos
 * faz fetch ao Route Handler /api/integrations/cep/{cep} (proxy ViaCEP do
 * Plan 02-03) e dispara onAutofill com logradouro/bairro/cidade/UF.
 *
 * Defesa T-02-07-07: useRef.lastQueried previne re-fetch do mesmo valor;
 * setTimeout cleanup cancela request se cep mudar antes dos 500ms.
 */

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export interface CepLookupResult {
  cep: string;
  logradouro: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
}

export function useCepAutofill(
  cep: string,
  onAutofill: (data: CepLookupResult) => void,
): { loading: boolean } {
  const [loading, setLoading] = useState(false);
  const lastQueried = useRef<string | null>(null);

  useEffect(() => {
    const sanitized = cep.replace(/\D/g, '');
    if (sanitized.length !== 8) return;
    if (lastQueried.current === sanitized) return;

    const handle = setTimeout(async () => {
      lastQueried.current = sanitized;
      setLoading(true);
      try {
        const res = await fetch(`/api/integrations/cep/${sanitized}`);
        if (!res.ok) {
          if (res.status === 404) {
            toast.error('CEP não encontrado.');
          }
          return;
        }
        const data = (await res.json()) as CepLookupResult;
        onAutofill(data);
      } catch {
        // silent — UX cosmética
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(handle);
  }, [cep, onAutofill]);

  return { loading };
}
