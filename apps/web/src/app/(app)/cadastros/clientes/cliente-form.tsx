'use client';

import { FormSection } from '@/components/cadastros/form-section';
import { FormToolbar } from '@/components/cadastros/form-toolbar';
import { FormField } from '@/components/forms/form-field';
import { MaskedInput } from '@/components/forms/masked-input';
import { UfSelect } from '@/components/forms/uf-select';
import type { Cliente } from '@/lib/mock-data';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input, cn } from '@nexo/ui';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const tipoEnum = ['PF', 'PJ'] as const;
const contribuinteEnum = ['sim', 'nao', 'isento'] as const;

const schema = z
  .object({
    tipo: z.enum(tipoEnum),
    // Comum
    documento: z.string().min(11, 'Informe CPF ou CNPJ.'),
    nome: z.string().min(2, 'Informe o nome / razão social.'),
    email: z
      .string()
      .optional()
      .refine((v) => !v || /\S+@\S+\.\S+/.test(v), 'E-mail inválido.'),
    telefone: z.string().optional(),
    // Endereço
    cep: z.string().optional(),
    logradouro: z.string().optional(),
    numero: z.string().optional(),
    bairro: z.string().optional(),
    cidade: z.string().min(2, 'Informe a cidade.'),
    uf: z.string().length(2, 'Selecione a UF.'),
    // PF
    rg: z.string().optional(),
    nascimento: z.string().optional(),
    // PJ
    ie: z.string().optional(),
    im: z.string().optional(),
    nomeFantasia: z.string().optional(),
    contato: z.string().optional(),
    // Fiscal
    contribuinteIcms: z.enum(contribuinteEnum),
    regimeEspecial: z.string().optional(),
    observacoes: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const digits = val.documento.replace(/\D/g, '');
    if (val.tipo === 'PF' && digits.length !== 11) {
      ctx.addIssue({ code: 'custom', path: ['documento'], message: 'CPF inválido.' });
    }
    if (val.tipo === 'PJ' && digits.length !== 14) {
      ctx.addIssue({ code: 'custom', path: ['documento'], message: 'CNPJ inválido.' });
    }
  });

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = {
  tipo: 'PJ',
  documento: '',
  nome: '',
  email: '',
  telefone: '',
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: '',
  rg: '',
  nascimento: '',
  ie: '',
  im: '',
  nomeFantasia: '',
  contato: '',
  contribuinteIcms: 'nao',
  regimeEspecial: '',
  observacoes: '',
};

function buildInitial(c?: Cliente): FormValues {
  if (!c) return defaultValues;
  return {
    ...defaultValues,
    tipo: c.tipo,
    documento: c.documento,
    nome: c.nome,
    email: c.email ?? '',
    telefone: c.telefone ?? '',
    cidade: c.cidade,
    uf: c.uf,
    cep: '01310-100',
    logradouro: 'Av. Paulista',
    numero: '1500',
    bairro: 'Bela Vista',
    contribuinteIcms: c.tipo === 'PJ' ? 'sim' : 'nao',
  };
}

export interface ClienteFormProps {
  mode: 'create' | 'edit';
  initial?: Cliente;
}

export function ClienteForm({ mode, initial }: ClienteFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildInitial(initial),
  });

  const tipo = watch('tipo');

  const onSubmit = handleSubmit(async () => {
    await new Promise((r) => setTimeout(r, 400));
    toast.success(mode === 'create' ? 'Cliente criado (mock)' : 'Cliente atualizado (mock)');
    if (mode === 'create') router.push('/cadastros/clientes');
  });

  const title =
    mode === 'create' ? 'Novo cliente' : `Editar cliente${initial ? ` · ${initial.nome}` : ''}`;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormToolbar
        title={title}
        subtitle="Base única de destinatários para emissão de NFS-e e NF-e."
        backHref="/cadastros/clientes"
        onCancel={() => router.push('/cadastros/clientes')}
        onSaveDraft={() => toast.message('Rascunho salvo (mock)')}
        onSubmit={() => void onSubmit()}
        isSubmitting={isSubmitting}
        submitLabel={mode === 'create' ? 'Criar cliente' : 'Salvar alterações'}
      />

      {/* Toggle PF/PJ */}
      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="tipo"
          render={({ field }) => (
            <div
              className="inline-flex rounded-md border bg-background p-1 text-sm"
              role="tablist"
              aria-label="Tipo de cliente"
            >
              {tipoEnum.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={field.value === t}
                  onClick={() => field.onChange(t)}
                  className={cn(
                    'rounded px-4 py-1.5 font-medium transition-colors',
                    field.value === t
                      ? 'bg-brand-blue text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      <FormSection
        title={tipo === 'PF' ? 'Dados pessoais' : 'Dados da empresa'}
        description={
          tipo === 'PF' ? 'Identificação da pessoa física.' : 'Identificação da pessoa jurídica.'
        }
      >
        <FormField
          label={tipo === 'PF' ? 'CPF' : 'CNPJ'}
          required
          error={errors.documento?.message}
        >
          <Controller
            control={control}
            name="documento"
            render={({ field }) => (
              <MaskedInput
                mask={tipo === 'PF' ? 'cpf' : 'cnpj'}
                value={field.value}
                onChange={field.onChange}
                placeholder={tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
              />
            )}
          />
        </FormField>
        <FormField
          label={tipo === 'PF' ? 'Nome completo' : 'Razão social'}
          required
          error={errors.nome?.message}
        >
          <Input
            {...register('nome')}
            placeholder={tipo === 'PF' ? 'Carlos Ferreira' : 'Construtora Horizonte LTDA'}
          />
        </FormField>

        {tipo === 'PF' ? (
          <>
            <FormField label="RG" error={errors.rg?.message}>
              <Input {...register('rg')} placeholder="12.345.678-9" />
            </FormField>
            <FormField label="Data de nascimento" error={errors.nascimento?.message}>
              <Input type="date" {...register('nascimento')} />
            </FormField>
          </>
        ) : (
          <>
            <FormField label="Nome fantasia" error={errors.nomeFantasia?.message}>
              <Input {...register('nomeFantasia')} placeholder="Horizonte" />
            </FormField>
            <FormField
              label="Inscrição Estadual"
              error={errors.ie?.message}
              hint="Deixe em branco se isento."
            >
              <Input {...register('ie')} placeholder="000.000.000.000" />
            </FormField>
            <FormField label="Inscrição Municipal" error={errors.im?.message}>
              <Input {...register('im')} placeholder="0000000-0" />
            </FormField>
            <FormField label="Contato comercial" error={errors.contato?.message}>
              <Input {...register('contato')} placeholder="Fernanda Lima" />
            </FormField>
          </>
        )}
      </FormSection>

      <FormSection title="Contato">
        <FormField label="E-mail" error={errors.email?.message}>
          <Input type="email" {...register('email')} placeholder="contato@cliente.com.br" />
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
                placeholder="(11) 3000-0000"
              />
            )}
          />
        </FormField>
      </FormSection>

      <FormSection title="Endereço" description="Usado como endereço padrão de entrega / fatura.">
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
          <Input {...register('logradouro')} placeholder="Av. Paulista" />
        </FormField>
        <FormField label="Número" error={errors.numero?.message}>
          <Input {...register('numero')} placeholder="1000" />
        </FormField>
        <FormField label="Bairro" error={errors.bairro?.message}>
          <Input {...register('bairro')} placeholder="Bela Vista" />
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

      <FormSection
        title="Observações fiscais"
        description="Dados que afetam destaque de imposto e obrigações acessórias."
      >
        <FormField label="Contribuinte de ICMS" required error={errors.contribuinteIcms?.message}>
          <select
            {...register('contribuinteIcms')}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
            <option value="isento">Isento</option>
          </select>
        </FormField>
        <FormField label="Regime especial" error={errors.regimeEspecial?.message}>
          <Input {...register('regimeEspecial')} placeholder="Ex: Simples, Substituto Tributário" />
        </FormField>
        <FormField
          label="Observações"
          className="md:col-span-2"
          error={errors.observacoes?.message}
        >
          <textarea
            {...register('observacoes')}
            rows={3}
            placeholder="Anotações internas sobre o cliente."
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
