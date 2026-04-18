import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { loadEnv } from './config/env';
import { DbModule } from './db/db.module';
import { LoggerModule } from './logger/logger.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClerkGuard } from './modules/auth/clerk.guard';
import { HealthModule } from './modules/health/health.module';
import { LgpdModule } from './modules/lgpd/lgpd.module';
import { SentryModule } from './modules/observability/sentry.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { RolesGuard } from './modules/rbac/roles.guard';
import { StorageModule } from './modules/storage/storage.module';
import { TenantsModule } from './modules/tenants/tenants.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: () => loadEnv(),
    }),
    LoggerModule,
    DbModule,
    AuthModule, // Clerk (Plan 07) — ClerkStrategy + ClerkGuard providers
    TenantsModule, // aplica TenantContextMiddleware globalmente
    RbacModule,
    AuditModule,
    StorageModule, // S3Service + ObjectLockVerifier (FOUND-11)
    LgpdModule, // Portal do titular (FOUND-12) — BLOCKER #2 Option A
    SentryModule, // Observability — Sentry bootstrap no-op sem DSN (Plan 01-10)
    HealthModule,
  ],
  providers: [
    // Ordem CRÍTICA (Plan 07):
    //  1. ClerkGuard valida JWT → popula req.auth
    //  2. RolesGuard lê req.auth e autoriza via user_memberships lookup
    // Inverter a ordem faria RolesGuard ver req.auth=undefined e falhar 403 sempre.
    {
      provide: APP_GUARD,
      useClass: ClerkGuard,
    },
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
