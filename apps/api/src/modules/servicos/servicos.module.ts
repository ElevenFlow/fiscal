import { Module } from '@nestjs/common';
import { ServicosController } from './servicos.controller';
import { ServicosService } from './servicos.service';

/** ServicosModule — CRUD multi-tenant de Servico (Phase 2 Plan 02-02). */
@Module({
  controllers: [ServicosController],
  providers: [ServicosService],
})
export class ServicosModule {}
