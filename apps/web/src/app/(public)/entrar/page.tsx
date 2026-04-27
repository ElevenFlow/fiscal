'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SigninSchema } from '@nexo/shared/auth';
import type { z } from 'zod';
import { useState } from 'react';
import { Button, Input } from '@nexo/ui';

type SigninForm = z.infer<typeof SigninSchema>;

/**
 * Inner component — useSearchParams() requer Suspense boundary no Next.js 16.
 * O componente pai EntrarPage envolve com <Suspense> para evitar erro de prerender.
 */
function EntrarForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SigninForm>({
    resolver: zodResolver(SigninSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(data: SigninForm) {
    setError(null);
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? 'Email ou senha incorretos');
        return;
      }

      const next = searchParams.get('next');
      // Whitelist: apenas paths internos (sem protocolo — T-02.1-03-01)
      const redirectTo = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
      router.push(redirectTo);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Entrar no Nexo Fiscal</h1>
        <p className="text-sm text-muted-foreground">Informe seu e-mail e senha</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            Senha
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
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
          {form.formState.isSubmitting ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Não tem conta?{' '}
        <a href="/cadastrar" className="underline hover:text-primary">
          Cadastre-se
        </a>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        <a href="/recuperar-senha" className="underline hover:text-primary">
          Esqueceu a senha?
        </a>
      </p>
    </div>
  );
}

/**
 * Página /entrar (Plan 02.1-03 — auth in-house).
 * Suspense necessário por causa do useSearchParams() no EntrarForm.
 */
export default function EntrarPage() {
  return (
    <Suspense fallback={<div className="w-full space-y-6 animate-pulse" />}>
      <EntrarForm />
    </Suspense>
  );
}
