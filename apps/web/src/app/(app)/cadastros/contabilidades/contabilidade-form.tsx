'use client';

import { FormSection } from '@/components/cadastros/form-section';
import { FormToolbar } from '@/components/cadastros/form-toolbar';
import { FormField } from '@/components/forms/form-field';
import { MaskedInput } from '@/components/forms/masked-input';
import { UfSelect } from '@/components/forms/uf-select';
import type { Contabilidade } from '@/lib/mock-data';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@nexo/ui';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const schema = z.object({
  razaoSocial: z.string().min(3, 'Informe a razão social.'),
  cnpj: z.string().refine((v) => v.replace(/\D/g, '').length === 14, 'CNPJ inválido.'),
  nomeFantasia: z.string().optional(),
  responsavelTecnico: z.string().min(3, 'Informe o responsável técnico.'),
  crc: z.string().min(3, 'Informe o CRC do responsável.'),
  cep: z.string().refine((v) => v.replace(/\D/g, '').length === 8, 'CEP inválido.'),
  logradouro: z.string().min(2, 'Informe o logradouro.'),
  numero: z.string().min(1, 'Informe o número.'),
  bairro: z.string().min(2, 'Informe o bairro.'),
  cidade: z.string().min(2, 'Informe a cidade.'),
  uf: z.string().length(2, 'Selecione a UF.'),
  email: z.string().email('E-mail inválido.'),
  telefone: z.string().refine((v) => v.replace(/\D/g, '').length >= 10, 'Telefone inválido.'),
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = {
  razaoSocial: '',
  cnpj: '',
  nomeFantasia: '',
  responsavelTecnico: '',
  crc: '',
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: '',
  email: '',
  telefone: '',
};

function buildInitial(c?: Contabilidade): FormValues {
  if (!c) return defaultValues;
  return {
    ...defaultValues,
    razaoSocial: c.razaoSocial,
    cnpj: c.cnpj,
    nomeFantasia: c.razaoSocial.split(' ')[0],
    responsavelTecnico: c.responsavel,
    crc: `CRC ${c.uf} 012.345/O-3`,
    cep: '04000-000',
    logradouro: 'Rua Augusta',
    numero: '500',
    bairro: 'Centro',
    cidade: c.cidade,
    uf: c.uf,
    email: `contato@${c.razaoSocial.toLowerCase().split(' ')[0]}.com.br`,
    telefone: '(11) 3000-0000',
  };
}

export interface ContabilidadeFormProps {
  mode: 'create' | 'edit';
  initial?: Contabilidade;
}

export function ContabilidadeForm({ mode, initial }: ContabilidadeFormProps) {
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
    toast.success(
      mode === 'create' ? 'Contabilidade criada (mock)' : 'Contabilidade atualizada (mock)',
    );
    if (mode === 'create') router.push('/cadastros/contabilidades');
  });

  const title =
    mode === 'create'
      ? 'Nova contabilidade'
      : `Editar contabilidade${initial ? ` · ${initial.razaoSocial}` : ''}`;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormToolbar
        title={title}
        subtitle="Escritório contábil responsável pelas empresas da carteira."
        backHref="/cadastros/contabilidades"
        onCancel={() => router.push('/cadastros/contabilidades')}
        onSaveDraft={() => toast.message('Rascunho salvo (mock)')}
        onSubmit={() => void onSubmit()}
        isSubmitting={isSubmitting}
        submitLabel={mode === 'create' ? 'Criar contabilidade' : 'Salvar alterações'}
      />

      <FormSection title="Dados da contabilidade">
        <FormField label="Razão social" required error={errors.razaoSocial?.message}>
          <Input {...register('razaoSocial')} placeholder="Prime Gestão Contábil LTDA" />
        </FormField>
        <FormField label="Nome fantasia" error={errors.nomeFantasia?.message}>
          <Input {...register('nomeFantasia')} placeholder="Prime Contábil" />
        </FormField>
        <FormField label="CNPJ" required error={errors.cnpj?.message}>
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
        </FormField>
        <FormField label="Responsável técnico" required error={errors.responsavelTecnico?.message}>
          <Input {...register('responsavelTecnico')} placeholder="Beatriz Prado" />
        </FormField>
        <FormField label="CRC" required error={errors.crc?.message}>
          <Input {...register('crc')} placeholder="CRC SP 012.345/O-3" />
        </FormField>
      </FormSection>

      <FormSection title="Endereço">
        <FormField label="CEP" required error={errors.cep?.message}>
          <Controller
            control={control}
            name="cep"
            render={({ field }) => (
              <MaskedInput
                mask="cep"
                value={field.value}
                onChange={field.onChange}
                placeholder="00000-000"
              />
            )}
          />
        </FormField>
        <FormField label="Logradouro" required error={errors.logradouro?.message}>
          <Input {...register('logradouro')} placeholder="Rua Augusta" />
        </FormField>
        <FormField label="Número" required error={errors.numero?.message}>
          <Input {...register('numero')} placeholder="500" />
        </FormField>
        <FormField label="Bairro" required error={errors.bairro?.message}>
          <Input {...register('bairro')} placeholder="Centro" />
        </FormField>
        <FormField label="Cidade" required error={errors.cidade?.message}>
          <Input {...register('cidade')} placeholder="São Paulo" />
        </FormField>
        <FormField label="UF" required error={errors.uf?.message}>
          <Controller
            control={control}
            name="uf"
            render={({ field }) => <UfSelect value={field.value} onChange={field.onChange} />}
          />
        </FormField>
      </FormSection>

      <FormSection title="Contato">
        <FormField label="E-mail" required error={errors.email?.message}>
          <Input type="email" {...register('email')} placeholder="contato@contabilidade.com.br" />
        </FormField>
        <FormField label="Telefone" required error={errors.telefone?.message}>
          <Controller
            control={control}
            name="telefone"
            render={({ field }) => (
              <MaskedInput
                mask="phone"
                value={field.value}
                onChange={field.onChange}
                placeholder="(11) 3000-0000"
              />
            )}
          />
        </FormField>
      </FormSection>
    </form>
  );
}
