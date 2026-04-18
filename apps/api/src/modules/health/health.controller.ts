import { Controller, Get } from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime (reflection-based injection).
import { PrismaService } from '../../db/prisma.service';
import { Public } from '../auth/clerk.guard';

/**
 * GET /api/health — liveness + dependency check.
 * Retorna 200 se Postgres responde SELECT 1 em < 1s.
 * Retorna 200 com `status:degraded` se DB indisponível.
 *
 * Plan 07: marcado @Public() para bypass do ClerkGuard (load balancer probes
 * não carregam JWT).
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check(): Promise<{
    status: 'ok' | 'degraded';
    db: 'ok' | 'error';
    uptime: number;
    timestamp: string;
  }> {
    let dbStatus: 'ok' | 'error' = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      db: dbStatus,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
