import { MiddlewareConsumer, Module, RequestMethod, type NestModule } from '@nestjs/common';
import { TenantContextMiddleware } from './tenant-context.middleware';
import { TenantContextGuard } from './tenant-context.guard';

@Module({
  providers: [TenantContextMiddleware, TenantContextGuard],
  exports: [TenantContextMiddleware, TenantContextGuard],
})
export class TenantsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantContextMiddleware)
      .exclude(
        { path: 'api/health', method: RequestMethod.GET },
        { path: 'health', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
