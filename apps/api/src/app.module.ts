import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { LoggerModule } from './logger/logger.module';
import { HealthModule } from './modules/health/health.module';
import { loadEnv } from './config/env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: () => loadEnv(), // Zod valida na boot
    }),
    LoggerModule,
    DbModule,
    HealthModule,
    // Tenants/Rbac/Audit modules adicionados em Task 2
  ],
})
export class AppModule {}
