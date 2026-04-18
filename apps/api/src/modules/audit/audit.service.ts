import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import { withTenantContext } from '../../db/with-tenant';
import { getCurrentTenant } from '../../db/tenant-context';

export interface AuditEventInput {
  action: string;
  resourceType?: string;
  resourceId?: string;
  diff?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  result: 'success' | 'failure';
}

/**
 * AuditService — grava eventos imutáveis em audit_log.
 * A tabela é particionada + trigger BEFORE UPDATE/DELETE rejeita mutations (Plan 04).
 *
 * PITFALLS.md #1 + #11: diff payload precisa estar COM PII REDIGIDA antes de chegar aqui.
 * Nunca passar objetos brutos que contenham CPF/CNPJ/senha — aplicar redação upstream.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditEventInput): Promise<void> {
    const scope = getCurrentTenant();
    const tenantId = scope?.tenantId ?? null;
    const userId = scope?.userId ?? null;

    await withTenantContext(
      this.prisma,
      {
        tenantId,
        userId,
        contabilidadeId: scope?.contabilidadeId ?? null,
        role: scope?.role ?? 'tenant_user',
      },
      async (tx) => {
        await tx.auditLog.create({
          data: {
            tenantId,
            userId,
            action: event.action,
            resourceType: event.resourceType,
            resourceId: event.resourceId,
            diff: event.diff as never, // Prisma aceita Json input
            ip: event.ip,
            userAgent: event.userAgent,
            result: event.result,
          },
        });
      },
    );
  }
}
