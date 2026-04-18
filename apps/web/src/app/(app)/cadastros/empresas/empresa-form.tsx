'use client';

import { FormSection } from '@/components/cadastros/form-section';
import { FormToolbar } from '@/components/cadastros/form-toolbar';
import { FormField } from '@/components/forms/form-field';
import { MaskedInput } from '@/components/forms/masked-input';
import { UfSelect } from '@/components/forms/uf-select';
import type { Empresa } from '@/lib/mock-data';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input, cn } from '@nexo/ui';
import { CheckCircle2, FileKey } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const regimes = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'] as const;

const empresaSchema = z.object({
  razaoSocial: z.string().min(3, 'Informe a razão social (mín. 3 caracteres).'),
  nomeFantasia: z.string().min(2, 'Informe o nome fantasia.'),
  cnpj: z.string().refine((v) => v.replace(/\D/g, '').length === 14, 'CNPJ inválido.'),
  ie: z.string().optional(),
  im: z.string().optional(),
  regime: z.enum(regimes, { errorMap: () => ({ message: 'Selecione um regime.' }) }),
  cnae: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-?\d\/?\d{2}$/.test(v) || /^\d{7}$/.test(v), 'CNAE inválido.'),
  cep: z.string().refine((v) => v.replace(/\D/g, '').length === 8, 'CEP inválido.'),
  logradouro: z.string().min(2, 'Informe o logradouro.'),
  numero: z.string().min(1, 'Informe o número.'),
  complemento: z.string().optional(),
  bairro: z.string().min(2, 'Informe o bairro.'),
  cidade: z.string().min(2, 'Informe a cidade.'),
  uf: z.string().length(2, 'Selecione a UF.'),
  email: z.string().email('E-mail inválido.'),
  telefone: z.string().refine((v) => v.replace(/\D/g, '').length >= 10, 'Telefone inválido.'),
  whatsapp: z.string().optional(),
  responsavel: z.string().min(2, 'Informe o responsável.'),
  certPassword: z.string().optional(),
});

export type EmpresaFormValues = z.infer<typeof empresaSchema>;

export interface EmpresaFormProps {
  mode: 'create' | 'edit';
  initialEmpresa?: Empresa;
}

const defaultValues: EmpresaFormValues = {
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  ie: '',
  im: '',
  regime: 'Simples Nacional',
  cnae: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  email: '',
  telefone: '',
  whatsapp: '',
  responsavel: '',
  certPassword: '',
};

function buildInitial(empresa?: Empresa): EmpresaFormValues {
  if (!empresa) return defaultValues;
  return {
    ...defaultValues,
    razaoSocial: empresa.razaoSocial,
    nomeFantasia: empresa.nomeFantasia,
    cnpj: empresa.cnpj,
    regime: empresa.regime,
    cidade: empresa.cidade,
    uf: empresa.uf,
    // Demais campos não existem no fixture — em produção virão do banco.
    cep: '01310-100',
    logradouro: 'Av. Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    email: `contato@${empresa.nomeFantasia.toLowerCase().replace(/\s+/g, '')}.com.br`,
    telefone: '(11) 3000-0000',
    responsavel: 'Rodrigo Silva',
  };
}

export function EmpresaForm({ mode, initialEmpresa }: EmpresaFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<EmpresaFormValues>({
    resolver: zodResolver(empresaSchema),
    defaultValues: buildInitial(initialEmpresa),
  });

  const onSubmit = handleSubmit(async (_values) => {
    await new Promise((r) => setTimeout(r, 400));
    toast.success(mode === 'create' ? 'Empresa criada (mock)' : 'Empresa atualizada (mock)');
    if (mode === 'create') router.push('/cadastros/empresas');
  });

  const onSaveDraft = () => {
    void getValues();
    toast.message('Rascunho salvo (mock)');
  };

  const title =
    mode === 'create'
      ? 'Nova empresa'
      : `Editar empresa${initialEmpresa ? ` · ${initialEmpresa.nomeFantasia}` : ''}`;
  const subtitle =
    mode === 'create'
      ? 'Cadastro completo em 4 seções. Tudo o que emitir notas precisa.'
      : 'Atualize dados cadastrais, endereço, contato e certificado A1.';

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormToolbar
        title={title}
        subtitle={subtitle}
        backHref="/cadastros/empresas"
        onCancel={() => router.push('/cadastros/empresas')}
        onSaveDraft={onSaveDraft}
        onSubmit={() => void onSubmit()}
        isSubmitting={isSubmitting}
        submitLabel={mode === 'create' ? 'Criar empresa' : 'Salvar alterações'}
      />

      <FormSection title="Dados da empresa" description="Identificação cadastral e fiscal.">
        <FormField label="Razão social" required error={errors.razaoSocial?.message}>
          <Input {...register('razaoSocial')} placeholder="Oliveira Tech Soluções LTDA" />
        </FormField>
        <FormField label="Nome fantasia" required error={errors.nomeFantasia?.message}>
          <Input {...register('nomeFantasia')} placeholder="Oliveira Tech" />
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
        <FormField label="Regime tributário" required error={errors.regime?.message}>
          <select
            {...register('regime')}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {regimes.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Inscrição Estadual (IE)"
          error={errors.ie?.message}
          hint="Deixe em branco se isento."
        >
          <Input {...register('ie')} placeholder="000.000.000.000" />
        </FormField>
        <FormField label="Inscrição Municipal (IM)" error={errors.im?.message}>
          <Input {...register('im')} placeholder="0000000-0" />
        </FormField>
        <FormField label="CNAE principal" error={errors.cnae?.message} className="md:col-span-2">
          <Input {...register('cnae')} placeholder="6201-5/01" />
        </FormField>
      </FormSection>

      <FormSection title="Endereço" description="Endereço fiscal de emissão.">
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
          <Input {...register('logradouro')} placeholder="Av. Paulista" />
        </FormField>
        <FormField label="Número" required error={errors.numero?.message}>
          <Input {...register('numero')} placeholder="1000" />
        </FormField>
        <FormField label="Complemento" error={errors.complemento?.message}>
          <Input {...register('complemento')} placeholder="Sala 401" />
        </FormField>
        <FormField label="Bairro" required error={errors.bairro?.message}>
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

      <FormSection title="Contato" description="Quem a plataforma aciona em caso de pendências.">
        <FormField label="E-mail" required error={errors.email?.message}>
          <Input type="email" {...register('email')} placeholder="contato@empresa.com.br" />
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
        <FormField label="WhatsApp" error={errors.whatsapp?.message}>
          <Controller
            control={control}
            name="whatsapp"
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
        <FormField label="Responsável" required error={errors.responsavel?.message}>
          <Input {...register('responsavel')} placeholder="Rodrigo Silva" />
        </FormField>
      </FormSection>

      <FormSection
        title="Certificado digital"
        description="A1 (.pfx) — armazenado cifrado com chave derivada do tenant."
      >
        <FormField label="Arquivo .pfx" hint="Selecione o certificado A1 em formato .pfx ou .p12.">
          <Input
            type="file"
            accept=".pfx,.p12"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) toast.success(`"${file.name}" anexado (mock)`);
              // Reset form control input to allow re-uploading same file
              e.currentTarget.value = '';
            }}
          />
        </FormField>
        <FormField label="Senha do certificado" error={errors.certPassword?.message}>
          <Input type="password" {...register('certPassword')} placeholder="••••••••" />
        </FormField>
        <div className="md:col-span-2">
          <div className="flex items-center gap-3 rounded-md border border-brand-green/30 bg-brand-green/5 p-3 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-green" aria-hidden />
            <div className="flex-1">
              <div className="font-medium text-brand-green">Certificado válido até 18/10/2026</div>
              <div className="text-xs text-muted-foreground">
                Vence em 180 dias. Renovação antecipada recomendada a partir de 30 dias.
              </div>
            </div>
            <FileKey className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
        </div>
      </FormSection>

      {/* Reset escondido só para manter referência ao RHF reset */}
      <button type="reset" className="hidden" onClick={() => reset(buildInitial(initialEmpresa))}>
        reset
      </button>
    </form>
  );
}
