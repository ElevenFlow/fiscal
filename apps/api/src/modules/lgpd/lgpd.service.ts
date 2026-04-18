import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import { withTenantContext } from '../../db/with-tenant';

export interface ExportPayload {
  user: {
    id: string;
    email: string;
    clerkUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  memberships: Array<{
    id: string;
    scopeType: string;
    scopeId: string | null;
    role: string;
    createdAt: Date;
  }>;
  auditEvents: Array<{
    id: string;
    action: string;
    resourceType: string | null;
    resourceId: string | null;
    result: string;
    createdAt: Date;
  }>;
  exportedAt: string;
  notice: string;
}

export interface CorrectionRequestInput {
  field: string;
  newValue: string;
  justification: string;
}

export interface DeletionRequestInput {
  reason: string;
}

/**
 * LgpdService — implementa direitos LGPD do titular (Art. 18).
 *
 * PITFALLS.md #16 — LGPD base legal: dados fiscais são tratados sob base legal
 * "obrigação legal ou regulatória" (Art. 7º II LGPD + CTN Arts. 173/174/195).
 * Exportação atende Art. 18 II (direito de acesso) e Art. 18 V (portabilidade).
 *
 * Lookup precisa rodar em contexto platform_admin: RLS em user_memberships e
 * audit_log requer GUC; o user está pedindo os PRÓPRIOS dados, bypass é legítimo
 * (mesma lógica aplicada no RolesGuard real — Plan 01-07).
 *
 * Todos os pedidos são registrados como eventos imutáveis em audit_log via
 * @Auditable no controller. Esta service apenas orquestra as queries/validações —
 * audit.record é disparado pelo interceptor (Plan 01-05).
 */
@Injectable()
export class LgpdService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Exporta todos os dados do titular (LGPD Art. 18 II e V).
   *
   * Escopo de segurança:
   *  - userId vem do ClerkGuard/req.auth (não de body/query) — impossível injetar
   *    id de outro usuário (T-09-01).
   *  - withTenantContext com role platform_admin mas filter WHERE userId === self
   *    garante escopo de IDENTIDADE (não tenant) — T-09-02 mitigado.
   *  - take: 1000 em auditEvents — MVP cap, previne DoS com 1M+ eventos (T-09-05).
   *    Paginação plena deferida para Phase 7 (hardening).
   */
  async exportTitularData(userId: string): Promise<ExportPayload> {
    return withTenantContext(
      this.prisma,
      { tenantId: null, role: 'platform_admin', userId },
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) {
          throw new NotFoundException(`User ${userId} not found`);
        }

        const memberships = await tx.userMembership.findMany({
          where: { userId },
          select: {
            id: true,
            scopeType: true,
            scopeId: true,
            role: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        // take: 1000 — MVP cap; paginação plena em Phase 7 (hardening).
        const auditEvents = await tx.auditLog.findMany({
          where: { userId },
          select: {
            id: true,
            action: true,
            resourceType: true,
            resourceId: true,
            result: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        });

        return {
          user: {
            id: user.id,
            email: user.email,
            clerkUserId: user.clerkUserId,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          memberships,
          auditEvents,
          exportedAt: new Date().toISOString(),
          notice:
            'Dados exportados conforme LGPD Art. 18 II e V. XMLs fiscais e audit events com valor ' +
            'legal são preservados por obrigação legal (CTN Arts. 173/174) mesmo após pedido de ' +
            'exclusão. Dúvidas: dpo@nexofiscal.com.br.',
        };
      },
    );
  }

  /**
   * Correção de dados (LGPD Art. 18 III).
   *
   * MVP: registra o pedido e notifica DPO via @Auditable. NÃO altera dados
   * automaticamente (exige análise humana + preservação de obrigação legal para
   * dados fiscais). Futuro (Phase 7): workflow com aprovação DPO + model LgpdRequest.
   */
  async requestCorrection(
    userId: string,
    input: CorrectionRequestInput,
  ): Promise<{ status: 'received'; protocoloId: string }> {
    // Validação mínima
    if (!input.field || input.field.length > 100) {
      throw new BadRequestException('field inválido (obrigatório, max 100 chars)');
    }
    if (!input.newValue || input.newValue.length > 1000) {
      throw new BadRequestException('newValue inválido (obrigatório, max 1000 chars)');
    }
    if (!input.justification || input.justification.length < 10) {
      throw new BadRequestException('justification precisa ter >= 10 caracteres');
    }

    // O @Auditable no controller grava audit_log com action='lgpd.correction_request'.
    // Retornamos um id de protocolo determinístico para o cliente rastrear.
    // Em Phase futura isso virará um model `LgpdRequest` próprio.
    const protocoloId = `LGPD-CORR-${Date.now()}-${userId.slice(0, 8)}`;

    return { status: 'received', protocoloId };
  }

  /**
   * Exclusão (LGPD Art. 18 VI).
   *
   * MVP: registra o pedido. NÃO apaga:
   *  - XMLs fiscais (Object Lock COMPLIANCE 6 anos — FOUND-11, Plan 01-08)
   *  - audit_log (trigger imutabilidade — FOUND-09, Plan 01-04)
   *  - dados fiscais (CTN Arts. 173/174/195 — retenção legal obrigatória)
   *
   * Anonimiza (fluxo manual DPO em até 15 dias úteis — LGPD Art. 19):
   *  - dados de marketing
   *  - perfil opcional (bio, foto, preferências não-fiscais)
   *  - preferências de comunicação
   *
   * Esta distinção é comunicada ao titular no portal `/app/privacidade` e na
   * política pública `/privacidade` (T-09-04).
   */
  async requestDeletion(
    userId: string,
    input: DeletionRequestInput,
  ): Promise<{ status: 'received'; protocoloId: string }> {
    if (!input.reason || input.reason.length < 10) {
      throw new BadRequestException('reason precisa ter >= 10 caracteres');
    }
    if (input.reason.length > 2000) {
      throw new BadRequestException('reason muito longo (max 2000 chars)');
    }

    const protocoloId = `LGPD-DEL-${Date.now()}-${userId.slice(0, 8)}`;
    return { status: 'received', protocoloId };
  }
}
