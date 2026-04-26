'use client';

/**
 * CnpjAutofillButton — Plan 02-07 Task 2.
 *
 * Botão "Buscar CNPJ" usado em forms PJ (Cliente, Fornecedor, Empresa).
 * Aciona /api/integrations/cnpj/{cnpj} (Route Handler proxy do Plan 02-03)
 * e popula campos via callback onAutofill.
 *
 * UX: spinner em loading; toast de erro amigável (404, 429, timeout, etc.).
 */

import { Button } from '@nexo/ui';
import { Loader2, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export interface CnpjAutofillData {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnae: string | null;
  endereco: {
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
  };
}

interface CnpjAutofillButtonProps {
  cnpj: string;
  onAutofill: (data: CnpjAutofillData) => void;
  disabled?: boolean;
}

export function CnpjAutofillButton({ cnpj, onAutofill, disabled }: CnpjAutofillButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const sanitized = cnpj.replace(/\D/g, '');
    if (sanitized.length !== 14) {
      toast.error('Informe um CNPJ válido (14 dígitos) para buscar.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/cnpj/${sanitized}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error('CNPJ não encontrado na BrasilAPI.');
        } else if (res.status === 429) {
          toast.error('Muitas consultas. Aguarde alguns segundos.');
        } else {
          toast.error('Erro ao consultar CNPJ. Tente novamente.');
        }
        return;
      }
      const data = (await res.json()) as CnpjAutofillData;
      onAutofill(data);
      toast.success('Dados preenchidos a partir da Receita Federal.');
    } catch {
      toast.error('Falha de rede ao consultar CNPJ.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading || disabled}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Search className="h-4 w-4" />
      )}
      <span className="ml-2">Buscar CNPJ</span>
    </Button>
  );
}
