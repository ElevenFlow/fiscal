import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Helper padrão shadcn/ui para concatenar classes Tailwind.
 * Usa clsx (condicionais) + tailwind-merge (dedup de classes conflitantes).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
