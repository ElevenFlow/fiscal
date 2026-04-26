import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';

/**
 * ClientesModule — CRUD multi-tenant de Cliente PF/PJ (Phase 2 Plan 02-02).
 * Endpoints sob /api/clientes; RLS via PrismaService global (DbModule).
 */
@Module({
  controllers: [ClientesController],
  providers: [ClientesService],
})
export class ClientesModule {}
