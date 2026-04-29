import { Module } from '@nestjs/common';
import { EstoqueController } from './estoque.controller';
import { EstoqueService } from './estoque.service';
import { XmlCompraParserService } from './xml-compra-parser.service';

@Module({
  controllers: [EstoqueController],
  providers: [EstoqueService, XmlCompraParserService],
})
export class EstoqueModule {}
