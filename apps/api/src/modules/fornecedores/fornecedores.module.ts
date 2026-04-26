import { Module } from '@nestjs/common';
import { FornecedoresController } from './fornecedores.controller';
import { FornecedoresService } from './fornecedores.service';

/** FornecedoresModule — CRUD multi-tenant de Fornecedor (Phase 2 Plan 02-02). */
@Module({
  controllers: [FornecedoresController],
  providers: [FornecedoresService],
})
export class FornecedoresModule {}
