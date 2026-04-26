'use client';

/**
 * Formulário de Contabilidade — Plan 02-07 Task 3.
 *
 * Schema @nexo/shared ContabilidadeCreateSchema.
 * Inclui CnpjAutofill + CepAutofill (PJ).
 */

import { CepAutofillIndicator, useCepAutofill } from '@/components/cadastros/cep-autofill';
import { CnpjAutofillButton } from '@/components/cadastros/cnpj-autofill-button';
import { FormSection } from '@/components/cadastros/form-section';
import { FormToolbar } from '@/components/cadastros/form-toolbar';
import { FormField } from '@/components/forms/form-field';
import { MaskedInput } from '@/components/forms/masked-input';
import { UfSelect } from '@/components/forms/uf-select';
import { ContabilidadeCreateSchema, type ContabilidadeCreateInput } from '@nexo/shared';
import { Input } from '@nexo/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';

export interface ContabilidadeInitial extends Partial<ContabilidadeCreateInput> {
  id?: string;
}

const defaultValues: ContabilidadeCreateInput = {
  nome: '',
  cnpj: '',
  endereco: {
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cep: '',
    cidade: '',
    uf: '',
  },
  contatos: {
    email: '',
    telefone: '',
    whatsapp: '',
    responsavel: '',
  },
};

function buildInitial(initial?: ContabilidadeInitial): ContabilidadeCreateInput {
  if (!initial) return defaultValues;
  return {
    ...defaultValues,
    ...initial,
    endereco: {
      ...(defaultValues.endereco ?? {}),
      ...(initial.endereco ?? {}),
    } as ContabilidadeCreateInput['endereco'],
    contatos: {
      ...(defaultValues.contatos ?? {}),
      ...(initial.contatos ?? {}),
    } as ContabilidadeCreateInput['contatos'],
  };
}

export interface ContabilidadeFormProps {
  mode: 'create' | 'edit';
  initial?: ContabilidadeInitial;
}

export function ContabilidadeForm({ mode, initial }: ContabilidadeFormProps) {
  const router = useRouter();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContabilidadeCreateInput>({
    resolver: zodResolver(ContabilidadeCreateSchema) as Resolver<ContabilidadeCreateInput>,
    defaultValues: buildInitial(initial),
  });

  const cnpj = useWatch({ control, name: 'cnpj' }) ?? '';
  const cep = useWatch({ control, name: 'endereco.cep' }) ?? '';

  const { loading: cepLoading } = useCepAutofill(cep, (data) => {
    if (data.logradouro) setValue('endereco.logradouro', data.logradouro);
    if (data.bairro) setValue('endereco.bairro', data.bairro);
    if (data.cidade) setValue('endereco.cidade', data.cidade);
    if (data.uf) setValue('endereco.uf', data.uf);
  });

  const mutation = useMutation({
    mutationFn: async (dto: ContabilidadeCreateInput) => {
      const url =
        mode === 'create' ? '/api/contabilidades' : `/api/contabilidades/${initial?.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409 && body.code === 'DUPLICATE_RESOURCE') {
          throw new Error('Já existe uma contabilidade com esse CNPJ.');
        }
        throw new Error(body.message ?? 'Erro ao salvar contabilidade');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contabilidades'] });
      qc.invalidateQueries({ queryKey: ['contabilidade'] });
      toast.success(
        mode === 'create' ? 'Contabilidade criada' : 'Contabilidade atualizada',
      );
      router.push('/cadastros/contabilidades');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const onSubmit = handleSubmit((dto) => mutation.mutate(dto));

  const title =
    mode === 'create'
      ? 'Nova contabilidade'
      : `Editar contabilidade${initial?.nome ? ` · ${initial.nome}` : ''}`;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormToolbar
        title={title}
        subtitle="Escritório contábil responsável pelas empresas da carteira."
        backHref="/cadastros/contabilidades"
        onCancel={() => router.push('/cadastros/contabilidades')}
        onSubmit={() => void onSubmit()}
        isSubmitting={isSubmitting || mutation.isPending}
        submitLabel={mode === 'create' ? 'Criar contabilidade' : 'Salvar alterações'}
      />

      <FormSection title="Dados da contabilidade">
        <FormField label="Nome" required error={errors.nome?.message}>
          <Input {...register('nome')} placeholder="Prime Gestão Contábil LTDA" />
        </FormField>
        <FormField label="CNPJ" required error={errors.cnpj?.message}>
          <div className="flex gap-2">
            <Controller
              control={control}
              name="cnpj"
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
                setValue('nome', data.razaoSocial);
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
          <Input {...register('endereco.logradouro')} placeholder="Rua Augusta" />
        </FormField>
        <FormField label="Número" error={errors.endereco?.numero?.message}>
          <Input {...register('endereco.numero')} placeholder="500" />
        </FormField>
        <FormField label="Complemento" error={errors.endereco?.complemento?.message}>
          <Input {...register('endereco.complemento')} placeholder="Sala 10" />
        </FormField>
        <FormField label="Bairro" error={errors.endereco?.bairro?.message}>
          <Input {...register('endereco.bairro')} placeholder="Centro" />
        </FormField>
        <FormField label="Cidade" error={errors.endereco?.cidade?.message}>
          <Input {...register('endereco.cidade')} placeholder="São Paulo" />
        </FormField>
        <FormField label="UF" error={errors.endereco?.uf?.message}>
          <Controller
            control={control}
            name="endereco.uf"
            render={({ field }) => (
              <UfSelect value={field.value ?? ''} onChange={field.onChange} />
            )}
          />
        </FormField>
      </FormSection>

      <FormSection title="Contato">
        <FormField label="E-mail" error={errors.contatos?.email?.message}>
          <Input
            type="email"
            {...register('contatos.email')}
            placeholder="contato@contabilidade.com.br"
          />
        </FormField>
        <FormField label="Telefone" error={errors.contatos?.telefone?.message}>
          <Controller
            control={control}
            name="contatos.telefone"
            render={({ field }) => (
              <MaskedInput
                mask="phone"
                value={field.value ?? ''}
                onChange={field.onChange}
                placeholder="(11) 3000-0000"
              />
            )}
          />
        </FormField>
        <FormField label="Responsável técnico" error={errors.contatos?.responsavel?.message}>
          <Input {...register('contatos.responsavel')} placeholder="Beatriz Prado" />
        </FormField>
      </FormSection>
    </form>
  );
}
