import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { DbModule } from './db/db.module';
import { LoggerModule } from './logger/logger.module';
import { HealthModule } from './modules/health/health.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { AuditModule } from './modules/audit/audit.module';
import { RolesGuard } from './modules/rbac/roles.guard';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { loadEnv } from './config/env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: () => loadEnv(),
    }),
    LoggerModule,
    DbModule,
    TenantsModule, // aplica TenantContextMiddleware globalmente
    RbacModule,
    AuditModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // Aplica RBAC globalmente; rotas sem @Roles() passam (early return)
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor, // Aplica globalmente; só grava se @Auditable() está presente
    },
  ],
})
export class AppModule {}
