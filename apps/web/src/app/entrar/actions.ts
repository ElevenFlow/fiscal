'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS, getAuthSecret, signSession } from '@/lib/session';

export interface LoginState {
  error: string | null;
}

/**
 * Credenciais de teste vêm de env vars. Sem banco, sem Clerk no modo protótipo.
 * Fallback de dev permite rodar localmente sem configurar .env.
 */
function getCredentials(): { email: string; password: string } {
  const email = process.env.AUTH_EMAIL || 'admin@nexofiscal.com.br';
  const password = process.env.AUTH_PASSWORD || 'nexo2026';
  return { email: email.toLowerCase(), password };
}

/**
 * Comparação em tempo constante — evita distinguir email inválido de senha
 * inválida por timing side-channel.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const pad = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < pad; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const senha = String(formData.get('senha') ?? '');

  if (!email || !senha) {
    return { error: 'Informe e-mail e senha.' };
  }

  const creds = getCredentials();
  const emailOk = timingSafeEqual(email, creds.email);
  const passOk = timingSafeEqual(senha, creds.password);

  if (!(emailOk && passOk)) {
    return { error: 'E-mail ou senha inválidos.' };
  }

  const token = await signSession(email, getAuthSecret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  redirect('/');
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
  redirect('/entrar');
}
