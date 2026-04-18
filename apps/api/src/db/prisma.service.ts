import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService — wraps PrismaClient como provider NestJS.
 * Conecta em onModuleInit e desconecta em onModuleDestroy.
 *
 * RLS é aplicado pelo Postgres; este serviço não seta tenant context
 * diretamente — isso é responsabilidade do helper `withTenantContext`.
 *
 * Ref: ARCHITECTURE.md (Multi-Tenancy Strategy), PITFALLS.md #1.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
