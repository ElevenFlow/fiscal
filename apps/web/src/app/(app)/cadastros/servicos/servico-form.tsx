'use client';

/**
 * Formulário de Serviço — Plan 02-07 Task 3.
 *
 * Schema @nexo/shared ServicoCreateSchema (LC 116).
 */

import { FormSection } from '@/components/cadastros/form-section';
import { FormToolbar } from '@/components/cadastros/form-toolbar';
import { FormField } from '@/components/forms/form-field';
import { ServicoCreateSchema, type ServicoCreateInput } from '@nexo/shared';
import { Input } from '@nexo/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';

export interface ServicoInitial extends Partial<ServicoCreateInput> {
  id?: string;
  ativo?: boolean;
}

const defaultValues: ServicoCreateInput = {
  codigoInterno: '',
  descricao: '',
  codigoMunicipal: '',
  cnae: null,
  precoPadrao: '0',
  aliquotaIss: '5',
  retencaoIr: null,
  retencaoInss: null,
  retencaoPis: null,
  retencaoCofins: null,
  retencaoCsll: null,
};

function buildInitial(initial?: ServicoInitial): ServicoCreateInput {
  if (!initial) return defaultValues;
  return { ...defaultValues, ...initial };
}

export interface ServicoFormProps {
  mode: 'create' | 'edit';
  initial?: ServicoInitial;
}

export function ServicoForm({ mode, initial }: ServicoFormProps) {
  const router = useRouter();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ServicoCreateInput>({
    resolver: zodResolver(ServicoCreateSchema) as Resolver<ServicoCreateInput>,
    defaultValues: buildInitial(initial),
  });

  const mutation = useMutation({
    mutationFn: async (dto: ServicoCreateInput) => {
      const url = mode === 'create' ? '/api/servicos' : `/api/servicos/${initial?.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409 && body.code === 'DUPLICATE_RESOURCE') {
          throw new Error('Já existe um serviço com esse código.');
        }
        throw new Error(body.message ?? 'Erro ao salvar serviço');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servicos'] });
      qc.invalidateQueries({ queryKey: ['servico'] });
      toast.success(mode === 'create' ? 'Serviço criado' : 'Serviço atualizado');
      router.push('/cadastros/servicos');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const onSubmit = handleSubmit((dto) => mutation.mutate(dto));

  const title =
    mode === 'create'
      ? 'Novo serviço'
      : `Editar serviço${initial?.descricao ? ` · ${initial.descricao}` : ''}`;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormToolbar
        title={title}
        subtitle="Catálogo de serviços para emissão de NFS-e (LC 116)."
        backHref="/cadastros/servicos"
        onCancel={() => router.push('/cadastros/servicos')}
        onSubmit={() => void onSubmit()}
        isSubmitting={isSubmitting || mutation.isPending}
        submitLabel={mode === 'create' ? 'Criar serviço' : 'Salvar alterações'}
      />

      <FormSection title="Identificação do serviço">
        <FormField label="Código interno" required error={errors.codigoInterno?.message}>
          <Input {...register('codigoInterno')} placeholder="SRV-CONSULT-ADM" className="font-mono" />
        </FormField>
        <FormField label="Descrição" required error={errors.descricao?.message}>
          <Input {...register('descricao')} placeholder="Consultoria Administrativa Mensal" />
        </FormField>
        <FormField
          label="Código municipal (LC 116)"
          required
          error={errors.codigoMunicipal?.message}
          hint="Item da lista de serviços — ex: 17.01 (administração)."
        >
          <Input {...register('codigoMunicipal')} placeholder="17.01" className="font-mono" />
        </FormField>
        <FormField label="CNAE" error={errors.cnae?.message}>
          <Input {...register('cnae')} placeholder="7020-4/00" className="font-mono" />
        </FormField>
      </FormSection>

      <FormSection
        title="Tributação"
        description="Alíquotas aplicadas na emissão. Retenções só são destacadas quando o tomador exigir."
      >
        <FormField label="Alíquota ISS (%)" required error={errors.aliquotaIss?.message}>
          <Input {...register('aliquotaIss')} inputMode="decimal" placeholder="5.00" />
        </FormField>
        <FormField
          label="Retenção IR (%)"
          error={errors.retencaoIr?.message}
          hint="Aplicável a PJ tomadoras em serviços específicos."
        >
          <Input {...register('retencaoIr')} inputMode="decimal" placeholder="1.50" />
        </FormField>
        <FormField label="INSS (%)" error={errors.retencaoInss?.message}>
          <Input {...register('retencaoInss')} inputMode="decimal" placeholder="0.00" />
        </FormField>
        <FormField label="PIS (%)" error={errors.retencaoPis?.message}>
          <Input {...register('retencaoPis')} inputMode="decimal" placeholder="0.65" />
        </FormField>
        <FormField label="COFINS (%)" error={errors.retencaoCofins?.message}>
          <Input {...register('retencaoCofins')} inputMode="decimal" placeholder="3.00" />
        </FormField>
        <FormField label="CSLL (%)" error={errors.retencaoCsll?.message}>
          <Input {...register('retencaoCsll')} inputMode="decimal" placeholder="1.00" />
        </FormField>
      </FormSection>

      <FormSection title="Comercial">
        <FormField label="Preço padrão" required error={errors.precoPadrao?.message}>
          <Input {...register('precoPadrao')} inputMode="decimal" placeholder="0.00" />
        </FormField>
      </FormSection>
    </form>
  );
}
