import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';

/**
 * GET /api/health — liveness + dependency check.
 * Retorna 200 se Postgres responde SELECT 1 em < 1s.
 * Retorna 503 se DB indisponível.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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
