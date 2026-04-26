'use client';

/**
 * Formulário de Cliente PF/PJ — Plan 02-07 Task 3.
 *
 * Migrado de fixture mock para API real:
 *  - Schema de @nexo/shared (ClienteCreateSchema) é o resolver do RHF.
 *  - useMutation chama Route Handler /api/clientes (POST/PATCH); 409 → toast amigável.
 *  - CnpjAutofillButton (PJ) chama /api/integrations/cnpj/:cnpj e popula campos.
 *  - useCepAutofill (debounce 500ms) preenche endereço a partir do CEP.
 *  - DuplicateWarning aparece embaixo do CPF/CNPJ se já houver no tenant.
 */

import { CepAutofillIndicator, useCepAutofill } from '@/components/cadastros/cep-autofill';
import { CnpjAutofillButton } from '@/components/cadastros/cnpj-autofill-button';
import { DuplicateWarning } from '@/components/cadastros/duplicate-warning';
import { FormSection } from '@/components/cadastros/form-section';
import { FormToolbar } from '@/components/cadastros/form-toolbar';
import { FormField } from '@/components/forms/form-field';
import { MaskedInput } from '@/components/forms/masked-input';
import { UfSelect } from '@/components/forms/uf-select';
import { ClienteCreateSchema, type ClienteCreateInput } from '@nexo/shared';
import { Input, cn } from '@nexo/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';

const tipoEnum = ['fisica', 'juridica'] as const;
const contribuinteEnum = ['sim', 'nao', 'isento'] as const;

export interface ClienteInitial extends Partial<ClienteCreateInput> {
  id?: string;
  ativo?: boolean;
}

const defaultValues: ClienteCreateInput = {
  tipoPessoa: 'juridica',
  cpfCnpj: '',
  nome: '',
  nomeFantasia: '',
  inscricaoEst: '',
  inscricaoMun: '',
  contribuinteIcms: 'nao',
  endereco: {
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cep: '',
    cidade: '',
    uf: '',
  },
  email: '',
  telefone: '',
  observacoes: '',
};

function buildInitial(initial?: ClienteInitial): ClienteCreateInput {
  if (!initial) return defaultValues;
  return {
    ...defaultValues,
    ...initial,
    endereco: {
      ...defaultValues.endereco,
      ...(initial.endereco ?? {}),
    },
  };
}

export interface ClienteFormProps {
  mode: 'create' | 'edit';
  initial?: ClienteInitial;
}

export function ClienteForm({ mode, initial }: ClienteFormProps) {
  const router = useRouter();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ClienteCreateInput>({
    // Cast: ClienteCreateSchema usa .transform() em cpfCnpjValidatedSchema
    // (input string com máscara → output dígitos). Resolver internamente devolve
    // o output, mas o form opera com input — cast é seguro porque RHF passa
    // o valor digitado direto ao Zod parse no submit.
    resolver: zodResolver(ClienteCreateSchema) as Resolver<ClienteCreateInput>,
    defaultValues: buildInitial(initial),
  });

  const tipoPessoa = useWatch({ control, name: 'tipoPessoa' });
  const cpfCnpj = useWatch({ control, name: 'cpfCnpj' }) ?? '';
  const cep = useWatch({ control, name: 'endereco.cep' }) ?? '';

  const { loading: cepLoading } = useCepAutofill(cep, (data) => {
    if (data.logradouro) setValue('endereco.logradouro', data.logradouro);
    if (data.bairro) setValue('endereco.bairro', data.bairro);
    if (data.cidade) setValue('endereco.cidade', data.cidade);
    if (data.uf) setValue('endereco.uf', data.uf);
  });

  const mutation = useMutation({
    mutationFn: async (dto: ClienteCreateInput) => {
      const url =
        mode === 'create' ? '/api/clientes' : `/api/clientes/${initial?.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409 && body.code === 'DUPLICATE_RESOURCE') {
          throw new Error('Já existe um cliente com esse CPF/CNPJ neste tenant.');
        }
        throw new Error(body.message ?? 'Erro ao salvar cliente');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['cliente'] });
      toast.success(mode === 'create' ? 'Cliente criado' : 'Cliente atualizado');
      router.push('/cadastros/clientes');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const onSubmit = handleSubmit((dto) => mutation.mutate(dto));

  const title =
    mode === 'create'
      ? 'Novo cliente'
      : `Editar cliente${initial?.nome ? ` · ${initial.nome}` : ''}`;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormToolbar
        title={title}
        subtitle="Base única de destinatários para emissão de NFS-e e NF-e."
        backHref="/cadastros/clientes"
        onCancel={() => router.push('/cadastros/clientes')}
        onSubmit={() => void onSubmit()}
        isSubmitting={isSubmitting || mutation.isPending}
        submitLabel={mode === 'create' ? 'Criar cliente' : 'Salvar alterações'}
      />

      {/* Toggle PF/PJ */}
      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="tipoPessoa"
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
                  {t === 'fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      <FormSection
        title={tipoPessoa === 'fisica' ? 'Dados pessoais' : 'Dados da empresa'}
        description={
          tipoPessoa === 'fisica'
            ? 'Identificação da pessoa física.'
            : 'Identificação da pessoa jurídica.'
        }
      >
        <FormField
          label={tipoPessoa === 'fisica' ? 'CPF' : 'CNPJ'}
          required
          error={errors.cpfCnpj?.message}
        >
          <div className="flex gap-2">
            <Controller
              control={control}
              name="cpfCnpj"
              render={({ field }) => (
                <MaskedInput
                  mask={tipoPessoa === 'fisica' ? 'cpf' : 'cnpj'}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={tipoPessoa === 'fisica' ? '000.000.000-00' : '00.000.000/0000-00'}
                />
              )}
            />
            {tipoPessoa === 'juridica' ? (
              <CnpjAutofillButton
                cnpj={cpfCnpj}
                onAutofill={(data) => {
                  setValue('nome', data.razaoSocial);
                  if (data.nomeFantasia) setValue('nomeFantasia', data.nomeFantasia);
                  if (data.endereco.cep) setValue('endereco.cep', data.endereco.cep);
                  if (data.endereco.logradouro)
                    setValue('endereco.logradouro', data.endereco.logradouro);
                  if (data.endereco.numero) setValue('endereco.numero', data.endereco.numero);
                  if (data.endereco.bairro) setValue('endereco.bairro', data.endereco.bairro);
                  if (data.endereco.cidade) setValue('endereco.cidade', data.endereco.cidade);
                  if (data.endereco.uf) setValue('endereco.uf', data.endereco.uf);
                }}
              />
            ) : null}
          </div>
          <DuplicateWarning resource="clientes" cpfCnpj={cpfCnpj} ignoreId={initial?.id} />
        </FormField>
        <FormField
          label={tipoPessoa === 'fisica' ? 'Nome completo' : 'Razão social'}
          required
          error={errors.nome?.message}
        >
          <Input
            {...register('nome')}
            placeholder={tipoPessoa === 'fisica' ? 'Carlos Ferreira' : 'Construtora Horizonte LTDA'}
          />
        </FormField>

        {tipoPessoa === 'juridica' ? (
          <>
            <FormField label="Nome fantasia" error={errors.nomeFantasia?.message}>
              <Input {...register('nomeFantasia')} placeholder="Horizonte" />
            </FormField>
            <FormField
              label="Inscrição Estadual"
              error={errors.inscricaoEst?.message}
              hint="Deixe em branco se isento."
            >
              <Input {...register('inscricaoEst')} placeholder="000.000.000.000" />
            </FormField>
            <FormField label="Inscrição Municipal" error={errors.inscricaoMun?.message}>
              <Input {...register('inscricaoMun')} placeholder="0000000-0" />
            </FormField>
          </>
        ) : null}
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
          <Input {...register('endereco.complemento')} placeholder="Sala 10" />
        </FormField>
        <FormField label="Bairro" error={errors.endereco?.bairro?.message}>
          <Input {...register('endereco.bairro')} placeholder="Bela Vista" />
        </FormField>
        <FormField label="Cidade" required error={errors.endereco?.cidade?.message}>
          <Input {...register('endereco.cidade')} placeholder="São Paulo" />
        </FormField>
        <FormField label="UF" required error={errors.endereco?.uf?.message}>
          <Controller
            control={control}
            name="endereco.uf"
            render={({ field }) => (
              <UfSelect value={field.value ?? ''} onChange={field.onChange} />
            )}
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Observações fiscais"
        description="Dados que afetam destaque de imposto e obrigações acessórias."
      >
        <FormField
          label="Contribuinte de ICMS"
          required
          error={errors.contribuinteIcms?.message}
        >
          <select
            {...register('contribuinteIcms')}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {contribuinteEnum.map((c) => (
              <option key={c} value={c}>
                {c === 'sim' ? 'Sim' : c === 'nao' ? 'Não' : 'Isento'}
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
