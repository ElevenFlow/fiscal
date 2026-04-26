'use client';

/**
 * Formulário de Empresa — Plan 02-07 Task 3.
 *
 * Schema @nexo/shared EmpresaCreateSchema. CnpjAutofill + CepAutofill ativos.
 * Não inclui upload de certificado neste form (telas dedicadas em /config/certificado).
 */

import { CepAutofillIndicator, useCepAutofill } from '@/components/cadastros/cep-autofill';
import { CnpjAutofillButton } from '@/components/cadastros/cnpj-autofill-button';
import { FormSection } from '@/components/cadastros/form-section';
import { FormToolbar } from '@/components/cadastros/form-toolbar';
import { FormField } from '@/components/forms/form-field';
import { MaskedInput } from '@/components/forms/masked-input';
import { UfSelect } from '@/components/forms/uf-select';
import { EmpresaCreateSchema, type EmpresaCreateInput } from '@nexo/shared';
import { Input, cn } from '@nexo/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';

const REGIMES = [
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
  { value: 'mei', label: 'MEI' },
] as const;

export interface EmpresaInitial extends Partial<EmpresaCreateInput> {
  id?: string;
  ativo?: boolean;
}

const defaultValues: EmpresaCreateInput = {
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  ie: '',
  im: '',
  cnae: '',
  regimeTributario: 'simples_nacional',
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
  contabilidadeId: null,
};

function buildInitial(initial?: EmpresaInitial): EmpresaCreateInput {
  if (!initial) return defaultValues;
  return {
    ...defaultValues,
    ...initial,
    endereco: {
      ...(defaultValues.endereco ?? {}),
      ...(initial.endereco ?? {}),
    } as EmpresaCreateInput['endereco'],
    contatos: {
      ...(defaultValues.contatos ?? {}),
      ...(initial.contatos ?? {}),
    } as EmpresaCreateInput['contatos'],
  };
}

export interface EmpresaFormProps {
  mode: 'create' | 'edit';
  initialEmpresa?: EmpresaInitial;
}

export function EmpresaForm({ mode, initialEmpresa }: EmpresaFormProps) {
  const router = useRouter();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EmpresaCreateInput>({
    resolver: zodResolver(EmpresaCreateSchema) as Resolver<EmpresaCreateInput>,
    defaultValues: buildInitial(initialEmpresa),
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
    mutationFn: async (dto: EmpresaCreateInput) => {
      const url = mode === 'create' ? '/api/empresas' : `/api/empresas/${initialEmpresa?.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409 && body.code === 'DUPLICATE_RESOURCE') {
          throw new Error('Já existe uma empresa com esse CNPJ.');
        }
        throw new Error(body.message ?? 'Erro ao salvar empresa');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empresas'] });
      qc.invalidateQueries({ queryKey: ['empresa'] });
      qc.invalidateQueries({ queryKey: ['empresas-minhas'] });
      toast.success(mode === 'create' ? 'Empresa criada' : 'Empresa atualizada');
      router.push('/cadastros/empresas');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const onSubmit = handleSubmit((dto) => mutation.mutate(dto));

  const title =
    mode === 'create'
      ? 'Nova empresa'
      : `Editar empresa${initialEmpresa?.razaoSocial ? ` · ${initialEmpresa.razaoSocial}` : ''}`;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormToolbar
        title={title}
        subtitle="Cadastro com identificação fiscal, endereço e contato."
        backHref="/cadastros/empresas"
        onCancel={() => router.push('/cadastros/empresas')}
        onSubmit={() => void onSubmit()}
        isSubmitting={isSubmitting || mutation.isPending}
        submitLabel={mode === 'create' ? 'Criar empresa' : 'Salvar alterações'}
      />

      <FormSection title="Dados da empresa" description="Identificação cadastral e fiscal.">
        <FormField label="Razão social" required error={errors.razaoSocial?.message}>
          <Input {...register('razaoSocial')} placeholder="Oliveira Tech Soluções LTDA" />
        </FormField>
        <FormField label="Nome fantasia" error={errors.nomeFantasia?.message}>
          <Input {...register('nomeFantasia')} placeholder="Oliveira Tech" />
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
                setValue('razaoSocial', data.razaoSocial);
                if (data.nomeFantasia) setValue('nomeFantasia', data.nomeFantasia);
                if (data.cnae) setValue('cnae', data.cnae);
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
        <FormField label="Regime tributário" required error={errors.regimeTributario?.message}>
          <select
            {...register('regimeTributario')}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {REGIMES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Inscrição Estadual (IE)" error={errors.ie?.message}>
          <Input {...register('ie')} placeholder="000.000.000.000" />
        </FormField>
        <FormField label="Inscrição Municipal (IM)" error={errors.im?.message}>
          <Input {...register('im')} placeholder="0000000-0" />
        </FormField>
        <FormField label="CNAE principal" error={errors.cnae?.message} className="md:col-span-2">
          <Input {...register('cnae')} placeholder="6201-5/01" />
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
          <Input {...register('endereco.logradouro')} placeholder="Av. Paulista" />
        </FormField>
        <FormField label="Número" error={errors.endereco?.numero?.message}>
          <Input {...register('endereco.numero')} placeholder="1000" />
        </FormField>
        <FormField label="Complemento" error={errors.endereco?.complemento?.message}>
          <Input {...register('endereco.complemento')} placeholder="Sala 401" />
        </FormField>
        <FormField label="Bairro" error={errors.endereco?.bairro?.message}>
          <Input {...register('endereco.bairro')} placeholder="Bela Vista" />
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

      <FormSection title="Contato" description="Quem a plataforma aciona em caso de pendências.">
        <FormField label="E-mail" error={errors.contatos?.email?.message}>
          <Input type="email" {...register('contatos.email')} placeholder="contato@empresa.com.br" />
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
        <FormField label="WhatsApp" error={errors.contatos?.whatsapp?.message}>
          <Controller
            control={control}
            name="contatos.whatsapp"
            render={({ field }) => (
              <MaskedInput
                mask="phone"
                value={field.value ?? ''}
                onChange={field.onChange}
                placeholder="(11) 90000-0000"
              />
            )}
          />
        </FormField>
        <FormField label="Responsável" error={errors.contatos?.responsavel?.message}>
          <Input {...register('contatos.responsavel')} placeholder="Rodrigo Silva" />
        </FormField>
      </FormSection>
    </form>
  );
}
