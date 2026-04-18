'use client';

import { Input, type InputProps } from '@nexo/ui';
import { forwardRef } from 'react';
import { maskBRL, maskCEP, maskCNPJ, maskCPF, maskPhone } from './masks';

export type MaskType = 'cnpj' | 'cpf' | 'cep' | 'phone' | 'brl';

const maskers: Record<MaskType, (value: string) => string> = {
  cnpj: maskCNPJ,
  cpf: maskCPF,
  cep: maskCEP,
  phone: maskPhone,
  brl: maskBRL,
};

export interface MaskedInputProps extends Omit<InputProps, 'onChange' | 'value' | 'defaultValue'> {
  mask: MaskType;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

/**
 * Input com máscara BR controlada. Mantém o valor formatado no DOM e emite o
 * valor já mascarado via callback — o consumidor guarda a string formatada
 * (padrão de campo fiscal: exibir e gravar com a mesma máscara).
 */
export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value, defaultValue, onChange, ...rest }, ref) => {
    const apply = maskers[mask];
    return (
      <Input
        ref={ref}
        value={value !== undefined ? apply(value) : undefined}
        defaultValue={defaultValue !== undefined ? apply(defaultValue) : undefined}
        onChange={(e) => onChange?.(apply(e.target.value))}
        inputMode={mask === 'brl' ? 'decimal' : 'numeric'}
        {...rest}
      />
    );
  },
);
MaskedInput.displayName = 'MaskedInput';
