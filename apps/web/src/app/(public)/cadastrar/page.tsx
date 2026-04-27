'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SignupSchema } from '@nexo/shared/auth';
import type { z } from 'zod';
import { useState } from 'react';
import { Button, Input } from '@nexo/ui';

type SignupForm = z.infer<typeof SignupSchema>;

export default function CadastrarPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignupForm>({
    resolver: zodResolver(SignupSchema),
    defaultValues: { email: '', password: '', fullName: '' },
  });

  async function onSubmit(data: SignupForm) {
    setError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? 'Erro ao criar conta. Tente novamente.');
        return;
      }

      router.push('/app');
    } catch {
      setError('Erro de conexão. Tente novamente.');
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Criar conta</h1>
        <p className="text-sm text-muted-foreground">Preencha os dados para começar</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="fullName" className="text-sm font-medium">
            Nome completo
          </label>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            disabled={form.formState.isSubmitting}
            {...form.register('fullName')}
          />
          {form.formState.errors.fullName && (
            <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            E-mail
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            disabled={form.formState.isSubmitting}
            {...form.register('email')}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Senha (mínimo 12 caracteres)
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            disabled={form.formState.isSubmitting}
            {...form.register('password')}
          />
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Criando conta...' : 'Criar conta'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <a href="/entrar" className="underline hover:text-primary">
          Entrar
        </a>
      </p>
    </div>
  );
}
