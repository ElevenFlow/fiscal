'use client';

/**
 * Formulário de Fornecedor — Plan 02-07 Task 3.
 *
 * Migrado de fixture mock para API real via @nexo/shared FornecedorCreateSchema.
 * Inclui CnpjAutofillButton + useCepAutofill + DuplicateWarning ('fornecedores').
 */

import { CepAutofillIndicator, useCepAutofill } from '@/components/cadastros/cep-autofill';
import { CnpjAutofillButton } from '@/components/cadastros/cnpj-autofill-button';
import { DuplicateWarning } from '@/components/cadastros/duplicate-warning';
import { FormSection } from '@/components/cadastros/form-section';
import { FormToolbar } from '@/components/cadastros/form-toolbar';
import { FormField } from '@/components/forms/form-field';
import { MaskedInput } from '@/components/forms/masked-input';
import { UfSelect } from '@/components/forms/uf-select';
import { FornecedorCreateSchema, type FornecedorCreateInput } from '@nexo/shared';
import { Input, cn } from '@nexo/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';

export interface FornecedorInitial extends Partial<FornecedorCreateInput> {
  id?: string;
  ativo?: boolean;
}

const defaultValues: FornecedorCreateInput = {
  cpfCnpj: '',
  razaoSocial: '',
  nomeFantasia: '',
  inscricaoEst: '',
  endereco: {
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cep: '',
    cidade: '',
    uf: '',
  },
  email: '',
  telefone: '',
  contatoComercial: '',
  condicoesPadrao: null,
};

function buildInitial(initial?: FornecedorInitial): FornecedorCreateInput {
  if (!initial) return defaultValues;
  return {
    ...defaultValues,
    ...initial,
    endereco: {
      ...defaultValues.endereco,
      ...(initial.endereco ?? {}),
    },
  };
}

export interface FornecedorFormProps {
  mode: 'create' | 'edit';
  initial?: FornecedorInitial;
}

export function FornecedorForm({ mode, initial }: FornecedorFormProps) {
  const router = useRouter();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FornecedorCreateInput>({
    resolver: zodResolver(FornecedorCreateSchema) as Resolver<FornecedorCreateInput>,
    defaultValues: buildInitial(initial),
  });

  const cnpj = useWatch({ control, name: 'cpfCnpj' }) ?? '';
  const cep = useWatch({ control, name: 'endereco.cep' }) ?? '';

  const { loading: cepLoading } = useCepAutofill(cep, (data) => {
    if (data.logradouro) setValue('endereco.logradouro', data.logradouro);
    if (data.bairro) setValue('endereco.bairro', data.bairro);
    if (data.cidade) setValue('endereco.cidade', data.cidade);
    if (data.uf) setValue('endereco.uf', data.uf);
  });

  const mutation = useMutation({
    mutationFn: async (dto: FornecedorCreateInput) => {
      const url =
        mode === 'create' ? '/api/fornecedores' : `/api/fornecedores/${initial?.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409 && body.code === 'DUPLICATE_RESOURCE') {
          throw new Error('Já existe um fornecedor com esse CNPJ neste tenant.');
        }
        throw new Error(body.message ?? 'Erro ao salvar fornecedor');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
      qc.invalidateQueries({ queryKey: ['fornecedor'] });
      toast.success(mode === 'create' ? 'Fornecedor criado' : 'Fornecedor atualizado');
      router.push('/cadastros/fornecedores');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const onSubmit = handleSubmit((dto) => mutation.mutate(dto));

  const title =
    mode === 'create'
      ? 'Novo fornecedor'
      : `Editar fornecedor${initial?.razaoSocial ? ` · ${initial.razaoSocial}` : ''}`;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormToolbar
        title={title}
        subtitle="Parceiro comercial com histórico de XMLs e condições padrão."
        backHref="/cadastros/fornecedores"
        onCancel={() => router.push('/cadastros/fornecedores')}
        onSubmit={() => void onSubmit()}
        isSubmitting={isSubmitting || mutation.isPending}
        submitLabel={mode === 'create' ? 'Criar fornecedor' : 'Salvar alterações'}
      />

      <FormSection title="Dados do fornecedor">
        <FormField label="CNPJ" required error={errors.cpfCnpj?.message}>
          <div className="flex gap-2">
            <Controller
              control={control}
              name="cpfCnpj"
              render={({ field }) => (
                <MaskedInput
                  mask="cnpj"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="00.000.000/0000-00"
                />
              )}
            />
            <CnpjAutofillButton
              cnpj={cnpj}
              onAutofill={(data) => {
                setValue('razaoSocial', data.razaoSocial);
                if (data.nomeFantasia) setValue('nomeFantasia', data.nomeFantasia);
                if (data.endereco.cep) setValue('endereco.cep', data.endereco.cep);
                if (data.endereco.logradouro)
                  setValue('endereco.logradouro', data.endereco.logradouro);
                if (data.endereco.numero) setValue('endereco.numero', data.endereco.numero);
                if (data.endereco.bairro) setValue('endereco.bairro', data.endereco.bairro);
                if (data.endereco.cidade) setValue('endereco.cidade', data.endereco.cidade);
                if (data.endereco.uf) setValue('endereco.uf', data.endereco.uf);
              }}
            />
          </div>
          <DuplicateWarning resource="fornecedores" cpfCnpj={cnpj} ignoreId={initial?.id} />
        </FormField>
        <FormField label="Razão social" required error={errors.razaoSocial?.message}>
          <Input {...register('razaoSocial')} placeholder="Distribuidora Sul Brasil LTDA" />
        </FormField>
        <FormField label="Nome fantasia" error={errors.nomeFantasia?.message}>
          <Input {...register('nomeFantasia')} placeholder="Sul Brasil" />
        </FormField>
        <FormField label="Inscrição Estadual" error={errors.inscricaoEst?.message}>
          <Input {...register('inscricaoEst')} placeholder="000.000.000.000" />
        </FormField>
      </FormSection>

      <FormSection title="Endereço" description="Auto-preenchido pelo CEP via ViaCEP.">
        <FormField label="CEP" error={errors.endereco?.cep?.message}>
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="endereco.cep"
              render={({ field }) => (
                <MaskedInput
                  mask="cep"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="00000-000"
                />
              )}
            />
            <CepAutofillIndicator loading={cepLoading} />
          </div>
        </FormField>
        <FormField label="Logradouro" error={errors.endereco?.logradouro?.message}>
          <Input {...register('endereco.logradouro')} placeholder="Av. Brasil" />
        </FormField>
        <FormField label="Número" error={errors.endereco?.numero?.message}>
          <Input {...register('endereco.numero')} placeholder="1000" />
        </FormField>
        <FormField label="Complemento" error={errors.endereco?.complemento?.message}>
          <Input {...register('endereco.complemento')} placeholder="Bloco A" />
        </FormField>
        <FormField label="Bairro" error={errors.endereco?.bairro?.message}>
          <Input {...register('endereco.bairro')} placeholder="Centro" />
        </FormField>
        <FormField label="Cidade" required error={errors.endereco?.cidade?.message}>
          <Input {...register('endereco.cidade')} placeholder="Porto Alegre" />
        </FormField>
        <FormField label="UF" required error={errors.endereco?.uf?.message}>
          <Controller
            control={control}
            name="endereco.uf"
            render={({ field }) => (
              <UfSelect value={field.value ?? ''} onChange={field.onChange} />
            )}
          />
        </FormField>
      </FormSection>

      <FormSection title="Contato comercial">
        <FormField label="Contato comercial" error={errors.contatoComercial?.message}>
          <Input {...register('contatoComercial')} placeholder="Roberto Campos" />
        </FormField>
        <FormField label="E-mail" error={errors.email?.message}>
          <Input type="email" {...register('email')} placeholder="contato@fornecedor.com.br" />
        </FormField>
        <FormField label="Telefone" error={errors.telefone?.message}>
          <Controller
            control={control}
            name="telefone"
            render={({ field }) => (
              <MaskedInput
                mask="phone"
                value={field.value ?? ''}
                onChange={field.onChange}
                placeholder="(51) 3000-0000"
              />
            )}
          />
        </FormField>
      </FormSection>
    </form>
  );
}
