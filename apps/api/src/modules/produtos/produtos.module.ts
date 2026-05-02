import { Module } from '@nestjs/common';
import { ProdutoFiscalValidationService } from './produto-fiscal-validation.service';
import { ProdutosController } from './produtos.controller';
import { ProdutosService } from './produtos.service';

/** ProdutosModule — CRUD multi-tenant de Produto (Phase 2 Plan 02-02). */
@Module({
  controllers: [ProdutosController],
  providers: [ProdutoFiscalValidationService, ProdutosService],
})
export class ProdutosModule {}
