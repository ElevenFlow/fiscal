import { BadRequestException, Injectable, Logger } from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { PrismaService } from '../../db/prisma.service';

/**
 * LookupService — autocomplete sobre catálogos fiscais globais (Plan 02-08).
 *
 * Tipos suportados: NCM (8 dígitos), CEST (7 dígitos), CFOP (4 dígitos),
 * LC 116 (códigos `X.XX`). Tabelas são públicas (sem RLS por design — Plan
 * 02-01 T-02-01-03/T-02-01-05) — qualquer usuário autenticado pode buscar.
 *
 * Algoritmo de busca:
 *  - Sem query: retorna primeiras N entradas ordenadas por código.
 *  - Com query: combina prefix-match em `codigo` (ILIKE) + similaridade
 *    trigram em `descricao` (operador `%` da extensão pg_trgm — habilitada
 *    em Plan 02-01 migration 300). Resultados ordenados: prefix-match primeiro
 *    (rank=0), depois por `1 - similarity(descricao, $query)` ASC (mais
 *    similar primeiro). Limite hard-cap em 100 (segurança contra abuso).
 *
 * Threat model:
 *  - T-02-08-02: $queryRawUnsafe usado para SQL com nome de tabela dinâmico,
 *    mas `tableName` é validado via union type fechado (whitelist) — não há
 *    interpolação de input do usuário no SQL. Os patterns ($1..$4) são
 *    parametrizados.
 *  - T-02-08-08: catálogos NCM/CFOP/LC116/CEST são públicos (Receita Federal,
 *    CONFAZ, Lei 116/2003) — não há informação confidencial; oracle attack
 *    via descrição não é vetor.
 */

const SUPPORTED_TYPES = ['ncm', 'cest', 'cfop', 'lc116'] as const;
type LookupType = (typeof SUPPORTED_TYPES)[number];

export const MIN_SIMILARITY_THRESHOLD = 0.2;

export interface LookupRow {
  codigo: string;
  descricao: string;
  // Campos extras por tabela; presentes apenas no tipo correspondente.
  ncmRelacionado?: string | null;
  tipo?: 'entrada' | 'saida';
}

@Injectable()
export class LookupService {
  private readonly logger = new Logger(LookupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async search(type: string, query: string | undefined, limit = 30): Promise<LookupRow[]> {
    if (!SUPPORTED_TYPES.includes(type as LookupType)) {
      throw new BadRequestException({
        code: 'INVALID_LOOKUP_TYPE',
        message: `Tipo invalido. Suportados: ${SUPPORTED_TYPES.join(', ')}`,
      });
    }
    const lookupType = type as LookupType;
    const q = (query ?? '').trim();
    // Hard cap 100 — defesa contra DoS via limit absurdo.
    const limitInt = Math.max(1, Math.min(Math.floor(limit), 100));

    if (q.length === 0) {
      return this.fetchTop(lookupType, limitInt);
    }

    return this.fetchSearch(lookupType, q, limitInt);
  }

  private async fetchTop(type: LookupType, limit: number): Promise<LookupRow[]> {
    const tableName = this.tableName(type);
    // Sem query: ordena por código asc — retorna primeiras N entradas.
    // $queryRawUnsafe pois o nome da tabela vem de whitelist fechada.
    const rows = await this.prisma.$queryRawUnsafe<LookupRow[]>(
      `SELECT codigo, descricao${type === 'cest' ? ', ncm_relacionado AS "ncmRelacionado"' : type === 'cfop' ? ', tipo' : ''}
       FROM ${tableName}
       ORDER BY codigo ASC
       LIMIT $1`,
      limit,
    );
    return rows;
  }

  private async fetchSearch(type: LookupType, q: string, limit: number): Promise<LookupRow[]> {
    const tableName = this.tableName(type);
    // Escape de wildcards LIKE (% _) no input do usuário; o operador `%` do
    // pg_trgm não tem wildcards (é função de similaridade).
    const safeQ = q.replace(/[%_\\]/g, '\\$&');
    const codigoPattern = `${safeQ}%`;
    const descPattern = `%${safeQ}%`;
    const extraSelect =
      type === 'cest'
        ? ', ncm_relacionado AS "ncmRelacionado"'
        : type === 'cfop'
          ? ', tipo'
          : '';

    // Algoritmo:
    //  - rank=0 quando codigo prefix-matches (ordena primeiro)
    //  - rank = 1 - similarity(descricao, q) quando matched apenas pela descrição
    //  - filtro: codigo prefix OR descricao ILIKE OR similarity > threshold
    // pg_trgm operador `%` testa similaridade > pg_trgm.similarity_threshold
    // (default 0.3); usamos similarity() explicitamente com threshold 0.2.
    const rows = await this.prisma.$queryRawUnsafe<LookupRow[]>(
      `SELECT codigo, descricao${extraSelect},
              CASE WHEN codigo ILIKE $1 THEN 0
                   ELSE 1 - similarity(descricao, $2)
              END AS rank
       FROM ${tableName}
       WHERE codigo ILIKE $1
          OR descricao ILIKE $3
          OR similarity(descricao, $2) > $4
       ORDER BY rank ASC, codigo ASC
       LIMIT $5`,
      codigoPattern,
      q,
      descPattern,
      MIN_SIMILARITY_THRESHOLD,
      limit,
    );
    // Remove `rank` do payload de saída (interno).
    return rows.map((r) => {
      const out: LookupRow & { rank?: number } = { ...r };
      delete out.rank;
      return out;
    });
  }

  private tableName(type: LookupType): 'ncm' | 'cest' | 'cfop' | 'lc116' {
    return type;
  }
}
