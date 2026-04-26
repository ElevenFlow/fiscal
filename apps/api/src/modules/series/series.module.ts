import { Module } from '@nestjs/common';
import { SeriesController } from './series.controller';
import { SeriesNumberingHelper } from './series-numbering.helper';
import { SeriesService } from './series.service';

/**
 * SeriesModule — CRUD séries fiscais + numeração transacional (Phase 2 Plan 02-06).
 *
 * Endpoints sob /api/series; RLS via PrismaService global (DbModule).
 *
 * Exporta:
 *  - `SeriesService` — Phase 3 (emissão) usa `assertEnvironmentMatch` (CERT-08).
 *  - `SeriesNumberingHelper` — Phase 3 (emissão) usa `getNextSeqAndIncrement`
 *    com `SELECT FOR UPDATE` para numeração atômica (CERT-06).
 */
@Module({
  controllers: [SeriesController],
  providers: [SeriesService, SeriesNumberingHelper],
  exports: [SeriesService, SeriesNumberingHelper],
})
export class SeriesModule {}
