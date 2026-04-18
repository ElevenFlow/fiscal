'use client';

import { FormSection } from '@/components/cadastros/form-section';
import { FormToolbar } from '@/components/cadastros/form-toolbar';
import { FormField } from '@/components/forms/form-field';
import { MaskedInput } from '@/components/forms/masked-input';
import { numberToBRL } from '@/components/forms/masks';
import type { Servico } from '@/lib/mock-data';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input, cn } from '@nexo/ui';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const schema = z.object({
  codigo: z.string().min(2, 'Informe o código interno.'),
  descricao: z.string().min(3, 'Informe a descrição.'),
  codigoMunicipal: z
    .string()
    .refine(
      (v) => /^\d{2}\.\d{2}$/.test(v) || /^\d{4}$/.test(v),
      'Código LC 116 inválido (XX.XX).',
    ),
  cnae: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-?\d\/?\d{2}$/.test(v) || /^\d{7}$/.test(v), 'CNAE inválido.'),
  aliquotaIss: z.string().min(1, 'Informe a alíquota ISS.'),
  retencaoIr: z.string().optional(),
  inss: z.string().optional(),
  pis: z.string().optional(),
  cofins: z.string().optional(),
  csll: z.string().optional(),
  precoPadrao: z.string().min(1, 'Informe o preço padrão.'),
  ativo: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = {
  codigo: '',
  descricao: '',
  codigoMunicipal: '',
  cnae: '',
  aliquotaIss: '5',
  retencaoIr: '1,5',
  inss: '0',
  pis: '0,65',
  cofins: '3,00',
  csll: '1,00',
  precoPadrao: '',
  ativo: true,
};

function buildInitial(s?: Servico): FormValues {
  if (!s) return defaultValues;
  return {
    ...defaultValues,
    codigo: s.codigo,
    descricao: s.descricao,
    codigoMunicipal: s.codigoMunicipal,
    aliquotaIss: numberToBRL(s.aliquotaIss),
    precoPadrao: numberToBRL(s.precoPadrao),
    ativo: s.ativo,
  };
}

export interface ServicoFormProps {
  mode: 'create' | 'edit';
  initial?: Servico;
}

export function ServicoForm({ mode, initial }: ServicoFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildInitial(initial),
  });

  const onSubmit = handleSubmit(async () => {
    await new Promise((r) => setTimeout(r, 400));
    toast.success(mode === 'create' ? 'Serviço criado (mock)' : 'Serviço atualizado (mock)');
    if (mode === 'create') router.push('/cadastros/servicos');
  });

  const title =
    mode === 'create'
      ? 'Novo serviço'
      : `Editar serviço${initial ? ` · ${initial.descricao}` : ''}`;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormToolbar
        title={title}
        subtitle="Catálogo de serviços para emissão de NFS-e (LC 116)."
        backHref="/cadastros/servicos"
        onCancel={() => router.push('/cadastros/servicos')}
        onSaveDraft={() => toast.message('Rascunho salvo (mock)')}
        onSubmit={() => void onSubmit()}
        isSubmitting={isSubmitting}
        submitLabel={mode === 'create' ? 'Criar serviço' : 'Salvar alterações'}
      />

      <FormSection title="Identificação do serviço">
        <FormField label="Código interno" required error={errors.codigo?.message}>
          <Input {...register('codigo')} placeholder="SRV-CONSULT-ADM" className="font-mono" />
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
          <Input {...register('aliquotaIss')} inputMode="decimal" placeholder="5,00" />
        </FormField>
        <FormField
          label="Retenção IR (%)"
          error={errors.retencaoIr?.message}
          hint="Aplicável a PJ tomadoras em serviços específicos."
        >
          <Input {...register('retencaoIr')} inputMode="decimal" placeholder="1,50" />
        </FormField>
        <FormField label="INSS (%)" error={errors.inss?.message}>
          <Input {...register('inss')} inputMode="decimal" placeholder="0,00" />
        </FormField>
        <FormField label="PIS (%)" error={errors.pis?.message}>
          <Input {...register('pis')} inputMode="decimal" placeholder="0,65" />
        </FormField>
        <FormField label="COFINS (%)" error={errors.cofins?.message}>
          <Input {...register('cofins')} inputMode="decimal" placeholder="3,00" />
        </FormField>
        <FormField label="CSLL (%)" error={errors.csll?.message}>
          <Input {...register('csll')} inputMode="decimal" placeholder="1,00" />
        </FormField>
      </FormSection>

      <FormSection title="Comercial">
        <FormField label="Preço padrão" required error={errors.precoPadrao?.message}>
          <Controller
            control={control}
            name="precoPadrao"
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
                  className={cn(
                    'h-4 w-4 rounded border-input text-brand-blue',
                    'focus-visible:outline-none',
                  )}
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
