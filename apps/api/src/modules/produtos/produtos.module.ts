import { Module } from '@nestjs/common';
import { ProdutosController } from './produtos.controller';
import { ProdutosService } from './produtos.service';

/** ProdutosModule — CRUD multi-tenant de Produto (Phase 2 Plan 02-02). */
@Module({
  controllers: [ProdutosController],
  providers: [ProdutosService],
})
export class ProdutosModule {}
