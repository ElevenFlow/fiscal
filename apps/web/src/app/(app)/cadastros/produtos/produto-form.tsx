'use client';

/**
 * Formulário de Produto — Plan 02-07 Task 3.
 *
 * Schema @nexo/shared ProdutoCreateSchema. Sem CNPJ/CEP autofill.
 * Cálculo de preço de venda (custo × margem) é cosmético — schema persiste
 * apenas precoVenda direto.
 */

import { FormSection } from '@/components/cadastros/form-section';
import { FormToolbar } from '@/components/cadastros/form-toolbar';
import { FormField } from '@/components/forms/form-field';
import { ProdutoCreateSchema, type ProdutoCreateInput } from '@nexo/shared';
import { Input, cn } from '@nexo/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';

const unidades = ['UN', 'KG', 'CX', 'M', 'PC', 'LT', 'RL'] as const;

export interface ProdutoInitial extends Partial<ProdutoCreateInput> {
  id?: string;
  ativo?: boolean;
}

const defaultValues: ProdutoCreateInput = {
  codigo: '',
  descricao: '',
  ncm: '',
  cest: null,
  cfopPadrao: null,
  cstIcms: null,
  csosn: null,
  origemMercadoria: 0,
  unidade: 'UN',
  peso: null,
  categoria: null,
  precoCusto: null,
  margem: null,
  precoVenda: '0',
  aliquotaIcms: null,
  aliquotaIpi: null,
  aliquotaPis: null,
  aliquotaCofins: null,
  estoqueInicial: null,
  estoqueMinimo: null,
  estoqueMaximo: null,
};

function buildInitial(initial?: ProdutoInitial): ProdutoCreateInput {
  if (!initial) return defaultValues;
  return { ...defaultValues, ...initial };
}

export interface ProdutoFormProps {
  mode: 'create' | 'edit';
  initial?: ProdutoInitial;
}

export function ProdutoForm({ mode, initial }: ProdutoFormProps) {
  const router = useRouter();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProdutoCreateInput>({
    resolver: zodResolver(ProdutoCreateSchema) as Resolver<ProdutoCreateInput>,
    defaultValues: buildInitial(initial),
  });

  const mutation = useMutation({
    mutationFn: async (dto: ProdutoCreateInput) => {
      const url = mode === 'create' ? '/api/produtos' : `/api/produtos/${initial?.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409 && body.code === 'DUPLICATE_RESOURCE') {
          throw new Error('Já existe um produto com esse código.');
        }
        throw new Error(body.message ?? 'Erro ao salvar produto');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produtos'] });
      qc.invalidateQueries({ queryKey: ['produto'] });
      toast.success(mode === 'create' ? 'Produto criado' : 'Produto atualizado');
      router.push('/cadastros/produtos');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const onSubmit = handleSubmit((dto) => mutation.mutate(dto));

  const title =
    mode === 'create'
      ? 'Novo produto'
      : `Editar produto${initial?.descricao ? ` · ${initial.descricao}` : ''}`;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormToolbar
        title={title}
        subtitle="SKU com NCM, CFOP, tributação e controle de estoque."
        backHref="/cadastros/produtos"
        onCancel={() => router.push('/cadastros/produtos')}
        onSubmit={() => void onSubmit()}
        isSubmitting={isSubmitting || mutation.isPending}
        submitLabel={mode === 'create' ? 'Criar produto' : 'Salvar alterações'}
      />

      <FormSection title="Identificação">
        <FormField label="SKU" required error={errors.codigo?.message}>
          <Input {...register('codigo')} placeholder="CAB-FLEX-2.5" className="font-mono" />
        </FormField>
        <FormField label="Descrição" required error={errors.descricao?.message}>
          <Input {...register('descricao')} placeholder="Cabo Flexível 2,5mm² 750V" />
        </FormField>
        <FormField label="Categoria" error={errors.categoria?.message}>
          <Input {...register('categoria')} placeholder="Elétrica" />
        </FormField>
        <FormField label="Unidade" required error={errors.unidade?.message}>
          <Controller
            control={control}
            name="unidade"
            render={({ field }) => (
              <select
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                className={cn(
                  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                {unidades.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            )}
          />
        </FormField>
        <FormField label="Peso (kg)" error={errors.peso?.message}>
          <Input {...register('peso')} inputMode="decimal" placeholder="0.500" />
        </FormField>
      </FormSection>

      <FormSection title="Classificação fiscal" description="Códigos usados na emissão de NF-e.">
        <FormField label="NCM (8 dígitos)" required error={errors.ncm?.message}>
          <Input {...register('ncm')} placeholder="85444900" className="font-mono" />
        </FormField>
        <FormField label="CEST (7 dígitos)" error={errors.cest?.message}>
          <Input {...register('cest')} placeholder="0000000" className="font-mono" />
        </FormField>
        <FormField label="CFOP padrão (4 dígitos)" error={errors.cfopPadrao?.message}>
          <Input {...register('cfopPadrao')} placeholder="5102" className="font-mono" />
        </FormField>
        <FormField label="CST ICMS" error={errors.cstIcms?.message}>
          <Input {...register('cstIcms')} placeholder="00" className="font-mono" />
        </FormField>
        <FormField label="CSOSN (Simples)" error={errors.csosn?.message}>
          <Input {...register('csosn')} placeholder="102" className="font-mono" />
        </FormField>
        <FormField label="Origem mercadoria (0-8)" error={errors.origemMercadoria?.message}>
          <Input
            type="number"
            min={0}
            max={8}
            {...register('origemMercadoria', { valueAsNumber: true })}
          />
        </FormField>
        <FormField label="Alíquota ICMS (%)" error={errors.aliquotaIcms?.message}>
          <Input {...register('aliquotaIcms')} inputMode="decimal" placeholder="18.00" />
        </FormField>
        <FormField label="Alíquota IPI (%)" error={errors.aliquotaIpi?.message}>
          <Input {...register('aliquotaIpi')} inputMode="decimal" placeholder="0.00" />
        </FormField>
        <FormField label="PIS (%)" error={errors.aliquotaPis?.message}>
          <Input {...register('aliquotaPis')} inputMode="decimal" placeholder="1.65" />
        </FormField>
        <FormField label="COFINS (%)" error={errors.aliquotaCofins?.message}>
          <Input {...register('aliquotaCofins')} inputMode="decimal" placeholder="7.60" />
        </FormField>
      </FormSection>

      <FormSection title="Preços">
        <FormField label="Preço de custo" error={errors.precoCusto?.message}>
          <Input {...register('precoCusto')} inputMode="decimal" placeholder="10.00" />
        </FormField>
        <FormField label="Margem (%)" error={errors.margem?.message}>
          <Input {...register('margem')} inputMode="decimal" placeholder="40" />
        </FormField>
        <FormField
          label="Preço de venda"
          required
          error={errors.precoVenda?.message}
          className="md:col-span-2"
        >
          <Input {...register('precoVenda')} inputMode="decimal" placeholder="14.00" />
        </FormField>
      </FormSection>

      <FormSection title="Estoque">
        <FormField label="Estoque inicial" error={errors.estoqueInicial?.message}>
          <Input {...register('estoqueInicial')} inputMode="numeric" placeholder="0" />
        </FormField>
        <FormField label="Mínimo" error={errors.estoqueMinimo?.message}>
          <Input {...register('estoqueMinimo')} inputMode="numeric" placeholder="0" />
        </FormField>
        <FormField label="Máximo" error={errors.estoqueMaximo?.message}>
          <Input {...register('estoqueMaximo')} inputMode="numeric" placeholder="0" />
        </FormField>
      </FormSection>
    </form>
  );
}
