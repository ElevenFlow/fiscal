import { Module } from '@nestjs/common';
import { ContabilidadesController } from './contabilidades.controller';
import { ContabilidadesService } from './contabilidades.service';

/**
 * ContabilidadesModule — CRUD de Contabilidade (escritório contábil) (Phase 2 Plan 02-02).
 * Top-level (sem tenant_id). RBAC restrito a admin + contabilidade_owner.
 */
@Module({
  controllers: [ContabilidadesController],
  providers: [ContabilidadesService],
})
export class ContabilidadesModule {}
