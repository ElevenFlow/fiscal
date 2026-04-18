import { Module } from '@nestjs/common';
import { LgpdController } from './lgpd.controller';
import { LgpdService } from './lgpd.service';

/**
 * LgpdModule — portal do titular (FOUND-12).
 *
 * Endpoints:
 *  - GET  /api/lgpd/export              → ExportPayload JSON (Art. 18 II e V)
 *  - POST /api/lgpd/correction-request  → pedido de correção (Art. 18 III)
 *  - POST /api/lgpd/deletion-request    → pedido de exclusão (Art. 18 VI — respeitada retenção fiscal)
 *
 * Todas as rotas são auditadas via @Auditable e protegidas por RBAC (@Roles cobre os 6 perfis).
 */
@Module({
  controllers: [LgpdController],
  providers: [LgpdService],
  exports: [LgpdService],
})
export class LgpdModule {}
