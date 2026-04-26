import { Module } from '@nestjs/common';
import { LookupController } from './lookup.controller';
import { LookupService } from './lookup.service';

/**
 * LookupModule — autocomplete REST de catálogos fiscais (Plan 02-08, CAD-10).
 *
 * Endpoints sob `/api/lookup` — autocomplete trigram via pg_trgm (Plan 02-01).
 *
 * Tabelas-lookup são sem RLS (Plan 02-01) — catálogo público (NCM/CFOP/LC116
 * são informação aberta da Receita Federal e legislação).
 *
 * Plan 02-08 Task 3 estende este module com:
 *  - LookupSyncService (worker mensal NCM/CEST/CFOP/LC116)
 *  - LookupSyncProcessor (BullMQ)
 *  - LookupSyncScheduler (cron mensal dia 5 às 04:00 BRT)
 *  - 4 sources HTTP (com fallback para fixture)
 *  - BullModule.registerQueue('lookup-sync')
 */
@Module({
  controllers: [LookupController],
  providers: [LookupService],
  exports: [LookupService],
})
export class LookupModule {}
