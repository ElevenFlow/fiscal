/**
 * Whitelist de chaves permitidas em logs estruturados.
 * PITFALLS.md #11: blacklist falha quando um novo campo com PII é adicionado
 * e ninguém lembra de registrar no redact. Whitelist falha seguro: campo desconhecido
 * vira [OMITTED], não vaza PII.
 *
 * Esta lista deve crescer APENAS via revisão explícita (code review + security sign-off).
 */
export const ALLOWED_LOG_KEYS = new Set<string>([
  'tenantId',
  'userId',
  'action',
  'module',
  'durationMs',
  'status',
  'jobId',
  'queue',
  'noteId',
  'method',
  'url',
  'statusCode',
  'resourceType',
  'resourceId',
  'ip', // IP é PII em certos contextos; aceito aqui para forense de incidente
  'userAgent',
  'requestId',
  'spanId',
  'traceId',
  'env',
  'service',
]);

/**
 * safeLog(obj) — filtra um objeto arbitrário contra ALLOWED_LOG_KEYS.
 * Chaves não permitidas viram [OMITTED] (não são removidas — para preservar "shape" em SIEM).
 *
 * @example
 * ```ts
 * logger.info(safeLog({ userId: 'uuid', cpf: '111...' }), 'user lookup');
 * // sai: { userId: 'uuid', cpf: '[OMITTED]' } "user lookup"
 * ```
 */
export function safeLog(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    out[k] = ALLOWED_LOG_KEYS.has(k) ? obj[k] : '[OMITTED]';
  }
  return out;
}
