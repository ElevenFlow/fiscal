import { accessSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolve fixture path tolerante a cwd:
 *  - Quando rodando do monorepo root: <root>/apps/api/prisma/fixtures/{name}
 *  - Quando rodando de apps/api (vitest, nest start): <apps/api>/prisma/fixtures/{name}
 *  - Quando rodando do dist/ (compilado): caminho relativo ao __dirname.
 *
 * Tenta em ordem; retorna o primeiro que existir. Se nenhum existir, retorna
 * o primeiro candidato (vai produzir ENOENT consistente que LookupSyncService
 * captura em try/catch e marca como falha — comportamento esperado).
 */
export function resolveFixturePath(name: string): string {
  const candidates = [
    join(process.cwd(), 'apps/api/prisma/fixtures', name),
    join(process.cwd(), 'prisma/fixtures', name),
    join(__dirname, '../../../../prisma/fixtures', name),
  ];
  for (const p of candidates) {
    try {
      accessSync(p);
      return p;
    } catch {
      // tenta próximo
    }
  }
  return candidates[0] ?? join(process.cwd(), 'apps/api/prisma/fixtures', name);
}
