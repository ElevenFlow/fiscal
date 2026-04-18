'use client';

import { FormSection } from '@/components/cadastros/form-section';
import { FormToolbar } from '@/components/cadastros/form-toolbar';
import { FormField } from '@/components/forms/form-field';
import { MaskedInput } from '@/components/forms/masked-input';
import { brlToNumber, numberToBRL } from '@/components/forms/masks';
import type { Produto } from '@/lib/mock-data';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input, cn } from '@nexo/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const unidades = ['UN', 'KG', 'CX', 'M', 'PC', 'LT', 'RL'] as const;

const schema = z.object({
  sku: z.string().min(2, 'Informe o SKU.'),
  descricao: z.string().min(3, 'Informe a descrição.'),
  ncm: z.string().refine((v) => /^\d{4}\.?\d{2}\.?\d{2}$/.test(v), 'NCM inválido (XXXX.XX.XX).'),
  cest: z.string().optional(),
  unidade: z.enum(unidades),
  categoria: z.string().min(2, 'Informe a categoria.'),
  pesoLiquido: z.string().optional(),
  pesoBruto: z.string().optional(),
  precoCusto: z.string().min(1, 'Informe o preço de custo.'),
  margem: z.string().min(1, 'Informe a margem.'),
  precoVenda: z.string().min(1, 'Informe o preço de venda.'),
  cfopSaida: z.string().refine((v) => /^\d{4}$/.test(v), 'CFOP saída inválido (4 dígitos).'),
  cfopEntrada: z.string().refine((v) => /^\d{4}$/.test(v), 'CFOP entrada inválido (4 dígitos).'),
  cst: z.string().min(2, 'Informe CST/CSOSN.'),
  aliquotaIcms: z.string(),
  pis: z.string(),
  cofins: z.string(),
  estoqueInicial: z.string(),
  estoqueMinimo: z.string(),
  estoqueMaximo: z.string(),
  ativo: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = {
  sku: '',
  descricao: '',
  ncm: '',
  cest: '',
  unidade: 'UN',
  categoria: '',
  pesoLiquido: '',
  pesoBruto: '',
  precoCusto: '',
  margem: '40',
  precoVenda: '',
  cfopSaida: '5102',
  cfopEntrada: '1102',
  cst: '00',
  aliquotaIcms: '18',
  pis: '1,65',
  cofins: '7,60',
  estoqueInicial: '0',
  estoqueMinimo: '0',
  estoqueMaximo: '0',
  ativo: true,
};

function buildInitial(p?: Produto): FormValues {
  if (!p) return defaultValues;
  return {
    ...defaultValues,
    sku: p.sku,
    descricao: p.descricao,
    ncm: p.ncm,
    cest: p.cest ?? '',
    unidade: (unidades as readonly string[]).includes(p.unidade)
      ? (p.unidade as (typeof unidades)[number])
      : 'UN',
    categoria: p.categoria,
    precoCusto: numberToBRL(p.precoCusto),
    margem: numberToBRL(((p.precoVenda - p.precoCusto) / p.precoCusto) * 100),
    precoVenda: numberToBRL(p.precoVenda),
    estoqueInicial: String(p.estoque),
    estoqueMinimo: String(p.estoqueMinimo),
    estoqueMaximo: String(Math.max(p.estoque * 3, 50)),
  };
}

export interface ProdutoFormProps {
  mode: 'create' | 'edit';
  initial?: Produto;
}

export function ProdutoForm({ mode, initial }: ProdutoFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildInitial(initial),
  });

  const precoCusto = watch('precoCusto');
  const margem = watch('margem');

  // Recalcula preço de venda ao mudar custo ou margem.
  useEffect(() => {
    const custo = brlToNumber(precoCusto);
    const m = brlToNumber(margem);
    if (custo > 0) {
      const venda = custo * (1 + m / 100);
      setValue('precoVenda', numberToBRL(venda));
    }
  }, [precoCusto, margem, setValue]);

  const onSubmit = handleSubmit(async () => {
    await new Promise((r) => setTimeout(r, 400));
    toast.success(mode === 'create' ? 'Produto criado (mock)' : 'Produto atualizado (mock)');
    if (mode === 'create') router.push('/cadastros/produtos');
  });

  const title =
    mode === 'create'
      ? 'Novo produto'
      : `Editar produto${initial ? ` · ${initial.descricao}` : ''}`;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormToolbar
        title={title}
        subtitle="SKU com NCM, CFOP, tributação e controle de estoque."
        backHref="/cadastros/produtos"
        onCancel={() => router.push('/cadastros/produtos')}
        onSaveDraft={() => toast.message('Rascunho salvo (mock)')}
        onSubmit={() => void onSubmit()}
        isSubmitting={isSubmitting}
        submitLabel={mode === 'create' ? 'Criar produto' : 'Salvar alterações'}
      />

      <FormSection title="Identificação">
        <FormField label="SKU" required error={errors.sku?.message}>
          <Input {...register('sku')} placeholder="CAB-FLEX-2.5" className="font-mono" />
        </FormField>
        <FormField label="Descrição" required error={errors.descricao?.message}>
          <Input {...register('descricao')} placeholder="Cabo Flexível 2,5mm² 750V" />
        </FormField>
        <FormField label="Categoria" required error={errors.categoria?.message}>
          <Input {...register('categoria')} placeholder="Elétrica" />
        </FormField>
        <FormField label="Unidade" required error={errors.unidade?.message}>
          <select
            {...register('unidade')}
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
        </FormField>
        <FormField label="Peso líquido (kg)" error={errors.pesoLiquido?.message}>
          <Input {...register('pesoLiquido')} inputMode="decimal" placeholder="0,500" />
        </FormField>
        <FormField label="Peso bruto (kg)" error={errors.pesoBruto?.message}>
          <Input {...register('pesoBruto')} inputMode="decimal" placeholder="0,520" />
        </FormField>
      </FormSection>

      <FormSection title="Classificação fiscal" description="Códigos usados na emissão de NF-e.">
        <FormField label="NCM" required error={errors.ncm?.message}>
          <Input {...register('ncm')} placeholder="8544.49.00" className="font-mono" />
        </FormField>
        <FormField label="CEST" error={errors.cest?.message}>
          <Input {...register('cest')} placeholder="00.000.00" className="font-mono" />
        </FormField>
        <FormField label="CFOP saída" required error={errors.cfopSaida?.message}>
          <Input {...register('cfopSaida')} placeholder="5102" className="font-mono" />
        </FormField>
        <FormField label="CFOP entrada" required error={errors.cfopEntrada?.message}>
          <Input {...register('cfopEntrada')} placeholder="1102" className="font-mono" />
        </FormField>
        <FormField
          label="CST / CSOSN"
          required
          error={errors.cst?.message}
          hint="CST para Presumido/Real; CSOSN para Simples."
        >
          <Input {...register('cst')} placeholder="00 / 102" className="font-mono" />
        </FormField>
        <FormField label="Alíquota ICMS (%)" error={errors.aliquotaIcms?.message}>
          <Input {...register('aliquotaIcms')} inputMode="decimal" placeholder="18,00" />
        </FormField>
        <FormField label="PIS (%)" error={errors.pis?.message}>
          <Input {...register('pis')} inputMode="decimal" placeholder="1,65" />
        </FormField>
        <FormField label="COFINS (%)" error={errors.cofins?.message}>
          <Input {...register('cofins')} inputMode="decimal" placeholder="7,60" />
        </FormField>
      </FormSection>

      <FormSection
        title="Preços"
        description="Preço de venda recalcula automaticamente a partir de custo × margem."
      >
        <FormField label="Preço de custo" required error={errors.precoCusto?.message}>
          <Controller
            control={control}
            name="precoCusto"
            render={({ field }) => (
              <MaskedInput
                mask="brl"
                value={field.value}
                onChange={field.onChange}
                placeholder="0,00"
              />
            )}
          />
        </FormField>
        <FormField label="Margem (%)" required error={errors.margem?.message}>
          <Input {...register('margem')} inputMode="decimal" placeholder="40" />
        </FormField>
        <FormField
          label="Preço de venda"
          required
          error={errors.precoVenda?.message}
          hint="Editável — sobrescreve o cálculo automático se você digitar."
          className="md:col-span-2"
        >
          <Controller
            control={control}
            name="precoVenda"
            render={({ field }) => (
              <MaskedInput
                mask="brl"
                value={field.value}
                onChange={field.onChange}
                placeholder="0,00"
              />
            )}
          />
        </FormField>
      </FormSection>

      <FormSection title="Estoque">
        <FormField label="Estoque inicial" error={errors.estoqueInicial?.message}>
          <Input {...register('estoqueInicial')} inputMode="numeric" placeholder="0" />
        </FormField>
        <FormField
          label="Mínimo"
          error={errors.estoqueMinimo?.message}
          hint="Aciona alerta quando saldo cair abaixo."
        >
          <Input {...register('estoqueMinimo')} inputMode="numeric" placeholder="0" />
        </FormField>
        <FormField label="Máximo" error={errors.estoqueMaximo?.message}>
          <Input {...register('estoqueMaximo')} inputMode="numeric" placeholder="0" />
        </FormField>
        <FormField label="Status" error={errors.ativo?.message}>
          <Controller
            control={control}
            name="ativo"
            render={({ field }) => (
              <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-brand-blue focus-visible:outline-none"
                />
                <span>{field.value ? 'Ativo' : 'Inativo'}</span>
              </label>
            )}
          />
        </FormField>
      </FormSection>
    </form>
  );
}
