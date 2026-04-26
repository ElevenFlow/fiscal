/**
 * Helper genérico para converter query string `sort=field:asc` em objeto
 * Prisma `orderBy`. Aceita whitelist de campos para defender contra ordenar
 * por campo arbitrário (T-02-02-06 — DoS via index miss).
 *
 * @example
 * ```ts
 * parseSort('razaoSocial:desc', { allowed: ['razaoSocial','createdAt'], default: { createdAt: 'desc' } })
 * // → { razaoSocial: 'desc' }
 * ```
 */
export function parseSort<TField extends string>(
  sort: string | undefined,
  opts: { allowed: readonly TField[]; default: Record<string, 'asc' | 'desc'> },
): Record<string, 'asc' | 'desc'> {
  if (!sort) return opts.default;
  const [field, dir = 'asc'] = sort.split(':');
  if (!field) return opts.default;
  // biome-ignore lint/suspicious/noExplicitAny: whitelist check returns the right narrowed type
  if (!(opts.allowed as readonly string[]).includes(field)) return opts.default;
  return { [field]: dir === 'desc' ? 'desc' : 'asc' };
}
