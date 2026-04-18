'use client';

import { FormSection } from '@/components/cadastros/form-section';
import { FormToolbar } from '@/components/cadastros/form-toolbar';
import { FormField } from '@/components/forms/form-field';
import { MaskedInput } from '@/components/forms/masked-input';
import { UfSelect } from '@/components/forms/uf-select';
import type { Fornecedor } from '@/lib/mock-data';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input, cn } from '@nexo/ui';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const formasPagamento = ['Boleto', 'PIX', 'Transferência', 'Cartão', 'Dinheiro'] as const;

const schema = z.object({
  cnpj: z.string().refine((v) => v.replace(/\D/g, '').length === 14, 'CNPJ inválido.'),
  razaoSocial: z.string().min(3, 'Informe a razão social.'),
  nomeFantasia: z.string().optional(),
  ie: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().min(2, 'Informe a cidade.'),
  uf: z.string().length(2, 'Selecione a UF.'),
  email: z
    .string()
    .optional()
    .refine((v) => !v || /\S+@\S+\.\S+/.test(v), 'E-mail inválido.'),
  telefone: z.string().optional(),
  contatoComercial: z.string().optional(),
  prazoPagamento: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), 'Informe apenas números (dias).'),
  formaPreferida: z.enum(formasPagamento),
  observacoes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = {
  cnpj: '',
  razaoSocial: '',
  nomeFantasia: '',
  ie: '',
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: '',
  email: '',
  telefone: '',
  contatoComercial: '',
  prazoPagamento: '30',
  formaPreferida: 'Boleto',
  observacoes: '',
};

function buildInitial(f?: Fornecedor): FormValues {
  if (!f) return defaultValues;
  return {
    ...defaultValues,
    cnpj: f.cnpj,
    razaoSocial: f.razaoSocial,
    nomeFantasia: f.razaoSocial.split(' ')[0],
    ie: '123.456.789.012',
    cep: '04000-000',
    logradouro: 'Av. Brasil',
    numero: '1000',
    bairro: 'Centro',
    cidade: f.cidade,
    uf: f.uf,
    email: `contato@${f.razaoSocial.toLowerCase().split(' ')[0]}.com.br`,
    telefone: '(51) 3000-4000',
    contatoComercial: 'Roberto Campos',
    prazoPagamento: '30',
    formaPreferida: 'Boleto',
  };
}

export interface FornecedorFormProps {
  mode: 'create' | 'edit';
  initial?: Fornecedor;
}

export function FornecedorForm({ mode, initial }: FornecedorFormProps) {
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
    toast.success(mode === 'create' ? 'Fornecedor criado (mock)' : 'Fornecedor atualizado (mock)');
    if (mode === 'create') router.push('/cadastros/fornecedores');
  });

  const title =
    mode === 'create'
      ? 'Novo fornecedor'
      : `Editar fornecedor${initial ? ` · ${initial.razaoSocial}` : ''}`;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormToolbar
        title={title}
        subtitle="Parceiro comercial com histórico de compras e condições padrão."
        backHref="/cadastros/fornecedores"
        onCancel={() => router.push('/cadastros/fornecedores')}
        onSaveDraft={() => toast.message('Rascunho salvo (mock)')}
        onSubmit={() => void onSubmit()}
        isSubmitting={isSubmitting}
        submitLabel={mode === 'create' ? 'Criar fornecedor' : 'Salvar alterações'}
      />

      <FormSection title="Dados do fornecedor">
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
        <FormField label="Razão social" required error={errors.razaoSocial?.message}>
          <Input {...register('razaoSocial')} placeholder="Distribuidora Sul Brasil LTDA" />
        </FormField>
        <FormField label="Nome fantasia" error={errors.nomeFantasia?.message}>
          <Input {...register('nomeFantasia')} placeholder="Sul Brasil" />
        </FormField>
        <FormField
          label="Inscrição Estadual"
          error={errors.ie?.message}
          hint="Obrigatória para emitir XML de compra correto."
        >
          <Input {...register('ie')} placeholder="000.000.000.000" />
        </FormField>
      </FormSection>

      <FormSection title="Endereço">
        <FormField label="CEP" error={errors.cep?.message}>
          <Controller
            control={control}
            name="cep"
            render={({ field }) => (
              <MaskedInput
                mask="cep"
                value={field.value ?? ''}
                onChange={field.onChange}
                placeholder="00000-000"
              />
            )}
          />
        </FormField>
        <FormField label="Logradouro" error={errors.logradouro?.message}>
          <Input {...register('logradouro')} placeholder="Av. Brasil" />
        </FormField>
        <FormField label="Número" error={errors.numero?.message}>
          <Input {...register('numero')} placeholder="1000" />
        </FormField>
        <FormField label="Bairro" error={errors.bairro?.message}>
          <Input {...register('bairro')} placeholder="Centro" />
        </FormField>
        <FormField label="Cidade" required error={errors.cidade?.message}>
          <Input {...register('cidade')} placeholder="Porto Alegre" />
        </FormField>
        <FormField label="UF" required error={errors.uf?.message}>
          <Controller
            control={control}
            name="uf"
            render={({ field }) => <UfSelect value={field.value} onChange={field.onChange} />}
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

      <FormSection title="Condições padrão">
        <FormField
          label="Prazo de pagamento (dias)"
          error={errors.prazoPagamento?.message}
          hint="Número de dias úteis para vencimento padrão."
        >
          <Input {...register('prazoPagamento')} inputMode="numeric" placeholder="30" />
        </FormField>
        <FormField label="Forma preferida" error={errors.formaPreferida?.message}>
          <select
            {...register('formaPreferida')}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {formasPagamento.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Observações"
          className="md:col-span-2"
          error={errors.observacoes?.message}
        >
          <textarea
            {...register('observacoes')}
            rows={3}
            placeholder="Notas internas sobre o fornecedor."
            className={cn(
              'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          />
        </FormField>
      </FormSection>
    </form>
  );
}
