'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@nexo/ui';

/**
 * ExportDataButton — chama route handler same-origin (BLOCKER #2 Option A).
 *
 * Client components NUNCA chamam apps/api direto. O flow é:
 *   client → /api/lgpd/export (Next.js Route Handler, same-origin, cookies Clerk)
 *   → fetchApi server-side → apps/api /api/lgpd/export (Bearer/headers)
 *
 * Isso mantém o token fora do browser context, elimina problemas de CORS,
 * e permite que o Clerk middleware server-side aplique auth normal.
 */
export function ExportDataButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/lgpd/export', {
        method: 'GET',
        credentials: 'include', // cookies Clerk fluem same-origin
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Erro ${res.status}: ${text.slice(0, 200)}`);
      }

      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `nexofiscal-meus-dados-${Date.now()}.json`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Falha ao exportar: ${err instanceof Error ? err.message : 'erro'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={loading}>
      <Download className="mr-2 h-4 w-4" />
      {loading ? 'Exportando...' : 'Exportar meus dados (JSON)'}
    </Button>
  );
}
