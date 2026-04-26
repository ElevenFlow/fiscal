import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_NAMES } from '../queue/queue.config';
import { LookupController } from './lookup.controller';
import { LookupService } from './lookup.service';
import { LookupSyncProcessor } from './lookup-sync.processor';
import { LookupSyncScheduler } from './lookup-sync.scheduler';
import { LookupSyncService } from './lookup-sync.service';
import { CestSource } from './sources/cest-source';
import { CfopSource } from './sources/cfop-source';
import { Lc116Source } from './sources/lc116-source';
import { NcmSource } from './sources/ncm-source';

/**
 * LookupModule — autocomplete REST + worker mensal de sync (Plan 02-08, CAD-10).
 *
 * Endpoints sob `/api/lookup/*` — autocomplete trigram via pg_trgm (Plan 02-01).
 *
 * Worker: cron mensal (dia 5 às 04:00 BRT = 07:00 UTC) sincroniza NCM/CEST/
 * CFOP/LC116 a partir de fontes oficiais com fallback para fixtures (Task 3).
 *
 * BullModule.registerQueue('lookup-sync') é redundante com QueueModule global
 * mas necessário aqui para que `@InjectQueue('lookup-sync')` no scheduler
 * resolva localmente — pattern recomendado pela doc oficial @nestjs/bullmq.
 *
 * Tabelas-lookup são sem RLS (Plan 02-01) — catálogo público.
 */
@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.LOOKUP_SYNC })],
  controllers: [LookupController],
  providers: [
    LookupService,
    LookupSyncService,
    LookupSyncProcessor,
    LookupSyncScheduler,
    NcmSource,
    CestSource,
    CfopSource,
    Lc116Source,
  ],
  exports: [LookupService, LookupSyncService],
})
export class LookupModule {}
