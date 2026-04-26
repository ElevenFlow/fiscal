import { Injectable, Logger } from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { PrismaService } from '../../db/prisma.service';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { CestSource, type CestEntry } from './sources/cest-source';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { CfopSource, type CfopEntry } from './sources/cfop-source';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { Lc116Source, type Lc116Entry } from './sources/lc116-source';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { NcmSource, type NcmEntry } from './sources/ncm-source';

/**
 * LookupSyncService — orquestra o sync mensal de NCM/CEST/CFOP/LC116
 * (Plan 02-08, CAD-10).
 *
 * Pattern:
 *  - syncAll() roda as 4 sources sequencialmente (não paralelo — minimiza
 *    load externo na BrasilAPI; é cron mensal, latência não importa).
 *  - Falha em uma source não bloqueia as outras (try/catch por source).
 *  - upsertBatch usa INSERT ... ON CONFLICT DO UPDATE em chunks de 500
 *    para idempotência — re-runs no mesmo dia atualizam atualizado_em
 *    sem duplicar linhas.
 *  - tableName vem de whitelist union type fechado (T-02-08-02): cols
 *    hardcoded de tipos NcmEntry/CestEntry/etc; valores via parametrized
 *    $1..$N (Prisma escapa).
 *
 * **RLS / privileges:** tabelas-lookup têm REVOKE INSERT/UPDATE/DELETE de
 * `app_user` (Plan 02-01 migration 500). Em PROD, o cron rodar com
 * `app_user` (DATABASE_URL padrão) **falhará** no INSERT. O caller (cron
 * processor) deve garantir que a conexão tem privilégio de escrita —
 * tipicamente via DATABASE_ADMIN_URL na env do worker, ou via
 * `withTenantContext({platform_admin})` quando uma migration futura
 * alterar a policy. Por hora, este sync funciona apenas em DEV/test
 * (LOOKUP_USE_FIXTURE=true) onde mock de Prisma cobre o pipeline.
 *
 * Documentado em SUMMARY como deferred-by-design (Phase 7 hardening).
 */

type LookupTable = 'ncm' | 'cest' | 'cfop' | 'lc116';

export interface SyncResult {
  ncm: number;
  cest: number;
  cfop: number;
  lc116: number;
  failures: string[];
}

@Injectable()
export class LookupSyncService {
  private readonly logger = new Logger(LookupSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ncmSource: NcmSource,
    private readonly cestSource: CestSource,
    private readonly cfopSource: CfopSource,
    private readonly lc116Source: Lc116Source,
  ) {}

  async syncAll(): Promise<SyncResult> {
    const failures: string[] = [];

    let ncmCount = 0;
    try {
      const items = await this.ncmSource.fetch();
      ncmCount = await this.upsertNcm(items);
    } catch (err) {
      const msg = `NCM sync failed: ${(err as Error).message}`;
      this.logger.error(msg);
      failures.push(msg);
    }

    let cestCount = 0;
    try {
      const items = await this.cestSource.fetch();
      cestCount = await this.upsertCest(items);
    } catch (err) {
      const msg = `CEST sync failed: ${(err as Error).message}`;
      this.logger.error(msg);
      failures.push(msg);
    }

    let cfopCount = 0;
    try {
      const items = await this.cfopSource.fetch();
      cfopCount = await this.upsertCfop(items);
    } catch (err) {
      const msg = `CFOP sync failed: ${(err as Error).message}`;
      this.logger.error(msg);
      failures.push(msg);
    }

    let lc116Count = 0;
    try {
      const items = await this.lc116Source.fetch();
      lc116Count = await this.upsertLc116(items);
    } catch (err) {
      const msg = `LC116 sync failed: ${(err as Error).message}`;
      this.logger.error(msg);
      failures.push(msg);
    }

    this.logger.log({
      action: 'lookup.sync.completed',
      ncmCount,
      cestCount,
      cfopCount,
      lc116Count,
      failureCount: failures.length,
    });

    return {
      ncm: ncmCount,
      cest: cestCount,
      cfop: cfopCount,
      lc116: lc116Count,
      failures,
    };
  }

  private async upsertNcm(items: NcmEntry[]): Promise<number> {
    return this.upsertBatch('ncm', items, ['codigo', 'descricao'], (i) => [i.codigo, i.descricao]);
  }

  private async upsertCest(items: CestEntry[]): Promise<number> {
    return this.upsertBatch(
      'cest',
      items,
      ['codigo', 'descricao', 'ncm_relacionado'],
      (i) => [i.codigo, i.descricao, i.ncmRelacionado ?? null],
    );
  }

  private async upsertCfop(items: CfopEntry[]): Promise<number> {
    return this.upsertBatch(
      'cfop',
      items,
      ['codigo', 'descricao', 'tipo'],
      (i) => [i.codigo, i.descricao, i.tipo],
    );
  }

  private async upsertLc116(items: Lc116Entry[]): Promise<number> {
    return this.upsertBatch('lc116', items, ['codigo', 'descricao'], (i) => [
      i.codigo,
      i.descricao,
    ]);
  }

  /**
   * Upsert generico em batches via INSERT ... ON CONFLICT DO UPDATE.
   *
   * Segurança (T-02-08-02):
   *  - `tableName` é union type fechado (whitelist).
   *  - `cols` são hardcoded por chamador (vêm de tipos TypeScript).
   *  - `values` parametrizados via $1..$N — Prisma escapa.
   *  - `tableName` e `cols` não vêm de input do usuário.
   */
  private async upsertBatch<T>(
    tableName: LookupTable,
    items: T[],
    cols: readonly string[],
    extract: (item: T) => unknown[],
    batchSize = 500,
  ): Promise<number> {
    if (items.length === 0) return 0;

    let processed = 0;
    const colsList = cols.map((c) => `"${c}"`).join(', ');
    const updateCols = cols
      .filter((c) => c !== 'codigo')
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(', ');

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const valuesList = batch
        .map((_, idx) => {
          const offset = idx * cols.length;
          return `(${cols.map((_c, ci) => `$${offset + ci + 1}`).join(', ')}, NOW())`;
        })
        .join(', ');
      const flatValues = batch.flatMap((row) => extract(row));

      const sql = `
        INSERT INTO ${tableName} (${colsList}, "atualizado_em")
        VALUES ${valuesList}
        ON CONFLICT (codigo) DO UPDATE
          SET ${updateCols}, "atualizado_em" = NOW()
      `;
      await this.prisma.$executeRawUnsafe(sql, ...flatValues);
      processed += batch.length;
    }
    return processed;
  }
}
