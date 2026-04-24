/**
 * Assinatura HMAC-SHA256 de cookies de sessão via Web Crypto.
 *
 * Compatível com Edge runtime (middleware) e Node runtime (Server Actions).
 * Modo protótipo: single-user, credenciais em env var. Quando restaurar Clerk,
 * substituir este módulo pela verificação de JWT do Clerk.
 */

export const SESSION_COOKIE_NAME = 'nexo_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const byte of arr) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): ArrayBuffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(padded);
  const buf = new ArrayBuffer(bin.length);
  const view = new DataView(buf);
  for (let i = 0; i < bin.length; i++) view.setUint8(i, bin.charCodeAt(i) & 0xff);
  return buf;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export interface SessionPayload {
  email: string;
  iat: number;
}

/**
 * Gera token `<payload_b64url>.<signature_b64url>` assinado com HMAC-SHA256.
 */
export async function signSession(email: string, secret: string): Promise<string> {
  const payload: SessionPayload = { email, iat: Date.now() };
  const payloadB64 = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  return `${payloadB64}.${b64urlEncode(sig)}`;
}

/**
 * Valida assinatura e idade do token. Retorna payload ou `null` se inválido/expirado.
 */
export async function verifySession(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  let sigBuf: ArrayBuffer;
  try {
    sigBuf = b64urlDecode(sigB64);
  } catch {
    return null;
  }

  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBuf,
    encoder.encode(payloadB64),
  );
  if (!valid) return null;

  try {
    const payload = JSON.parse(decoder.decode(b64urlDecode(payloadB64))) as SessionPayload;
    if (typeof payload.iat !== 'number' || typeof payload.email !== 'string') return null;
    if (Date.now() - payload.iat > SESSION_TTL_SECONDS * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Recupera secret obrigatório. Em prod, falha fechada se ausente.
 * Em dev, fallback de string fixa (não-segura) para não quebrar DX.
 */
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be set (min 16 chars) in production');
  }
  return 'dev-only-insecure-secret-never-use-in-production-32chars';
}
