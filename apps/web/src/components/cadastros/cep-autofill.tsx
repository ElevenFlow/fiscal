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

import { Loader2 } from 'lucide-react';
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

/**
 * Indicador visual de loading do useCepAutofill — usado em forms ao lado do
 * campo CEP. Apenas exibe ícone giratório quando loading=true.
 */
export function CepAutofillIndicator({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return (
    <span className="inline-flex h-9 items-center text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-label="Buscando CEP..." />
    </span>
  );
}
