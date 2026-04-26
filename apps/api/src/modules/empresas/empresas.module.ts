import { Module } from '@nestjs/common';
import { EmpresasController } from './empresas.controller';
import { EmpresasService } from './empresas.service';

/**
 * EmpresasModule — CRUD de Empresa (tenant) (Phase 2 Plan 02-02).
 * Inclui endpoint extra GET /api/empresas/minhas (identity-scoped via
 * contabilidadeId do session — usado pelo EmpresaSwitcher web).
 */
@Module({
  controllers: [EmpresasController],
  providers: [EmpresasService],
})
export class EmpresasModule {}
