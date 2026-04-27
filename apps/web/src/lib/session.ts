/**
 * session.ts — helpers de cookie de sessão JWT (Plan 02.1-03).
 *
 * Substitui o módulo HMAC anterior (modo protótipo).
 * Expõe constantes de nome de cookie e TTLs usados pelos Route Handlers proxy
 * e pelo middleware.
 *
 * Nota: em apps/web os Route Handlers apenas fazem proxy para apps/api.
 * O apps/api (AuthController) já seta os cookies na resposta original.
 * Estas constantes garantem consistência com apps/api auth.guard.ts.
 */

export const ACCESS_COOKIE = 'nf_access';
export const REFRESH_COOKIE = 'nf_refresh';

export const ACCESS_TTL_S = 15 * 60; // 15 minutos
export const REFRESH_TTL_S = 7 * 24 * 3600; // 7 dias

export interface CookieSetOptions {
  maxAge: number;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
}

export function accessCookieOptions(): CookieSetOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TTL_S,
  };
}

export function refreshCookieOptions(): CookieSetOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: REFRESH_TTL_S,
  };
}
