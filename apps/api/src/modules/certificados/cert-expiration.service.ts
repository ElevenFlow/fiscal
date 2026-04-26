import { Injectable, Logger } from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { PrismaService } from '../../db/prisma.service';

/**
 * Tier classification para alertas de vencimento de certificado A1.
 *
 * Tiers (Plan 02-05 must_haves):
 *  - D-60: 60 ≥ days > 30 — info
 *  - D-30: 30 ≥ days > 15 — warning
 *  - D-15: 15 ≥ days > 7  — critical
 *  - D-7:   7 ≥ days > 0  — critical
 *  - D-0:   days ≤ 0      — blocking
 *
 * Fora-da-janela (>60d futuro ou >730d no passado): null (sem alerta).
 */
export interface TierClassification {
  tier: 'D-60' | 'D-30' | 'D-15' | 'D-7' | 'D-0';
  severity: 'info' | 'warning' | 'critical' | 'blocking';
}

/**
 * Pure function — classifica daysRemaining em (tier, severity) ou null.
 *
 * Convenções de fronteira (must_haves do Plan):
 *  - days=60 → D-60 (faixa fechada à direita, aberta à esquerda)
 *  - days=30 → D-30, days=31 → D-60
 *  - days=0  → D-0 (vencido hoje), days=-1 → D-0 (já vencido)
 *  - days=-1000 → null (cap de 2 anos vencido para parar de poluir alertas)
 */
export function computeTier(daysRemaining: number): TierClassification | null {
  if (daysRemaining > 60) return null;
  if (daysRemaining > 30) return { tier: 'D-60', severity: 'info' };
  if (daysRemaining > 15) return { tier: 'D-30', severity: 'warning' };
  if (daysRemaining > 7) return { tier: 'D-15', severity: 'critical' };
  if (daysRemaining > 0) return { tier: 'D-7', severity: 'critical' };
  // 0 e negativos: D-0 / blocking até 2 anos vencido
  if (daysRemaining >= -730) return { tier: 'D-0', severity: 'blocking' };
  return null;
}

/**
 * Diferença em dias inteiros entre `from` e `to` (negativo se `to` é passado).
 * Floor garante que cert vencendo daqui a 25.5d retorne 25 (mais conservador
 * — o tier piora antes, não depois).
 */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / 86_400_000);
}

/**
 * CertExpirationService — varre certificados ativos da plataforma e gera
 * alertas D-60..D-0 idempotentemente. Plan 02-05.
 *
 * **Importante sobre RLS:** Este service roda dentro do BullMQ worker (cron
 * 03:00 BRT), FORA de qualquer request scope — não tem `app.current_tenant`
 * configurado. Por isso usa o `PrismaService` direto (sem `withTenantContext`).
 *
 * Como o `PrismaService` se conecta via `DATABASE_URL` (role `app_user` com
 * NOBYPASSRLS), a varredura cross-tenant SÓ funciona se a policy RLS de
 * `certificados_digitais` permitir leitura quando `app.current_tenant` é
 * NULL/vazio E `app.role = 'platform_admin'`. A migration 200 (Plan 02-01)
 * garante isso: `USING (current_setting('app.role')='platform_admin' OR ...)`.
 *
 * Para que o cron funcione no banco, o caller (CertExpirationProcessor) DEVE
 * envelopar `runOnce()` em uma transação que faça `SET LOCAL app.role =
 * 'platform_admin'` ANTES da query — feito via `withTenantContext` com
 * `{tenantId: null, role: 'platform_admin'}`. No teste, o mock do Prisma
 * ignora RLS e isso é irrelevante.
 *
 * Idempotência: `prisma.alertaCertificado.upsert` com chave composta
 * `(certificadoId, tier)` — re-runs no mesmo dia retornam a mesma row.
 *
 * Severity por tier: D-60→info, D-30→warning, D-15→critical, D-7→critical,
 * D-0→blocking.
 */
@Injectable()
export class CertExpirationService {
  private readonly logger = new Logger(CertExpirationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Varre certificados ativos e cria/atualiza linhas em `alertas_certificado`.
   *
   * @param now Data de referência para cálculo de dias restantes. Permite
   *   injeção em testes com fake clock; padrão é `new Date()`.
   * @returns `{processed}` total de certs ativos varridos, `{alertsCreated}`
   *   estimativa de alertas novos (heurística baseada em geradoEm ≈ now).
   */
  async runOnce(now: Date = new Date()): Promise<{ processed: number; alertsCreated: number }> {
    // Busca certs ativos (cross-tenant — cron de ops). O caller deve garantir
    // que esta query roda com role=platform_admin no banco. No teste, mock ignora.
    const certs = await this.prisma.certificadoDigital.findMany({
      where: { ativo: true },
      select: {
        id: true,
        tenantId: true,
        notAfter: true,
        cnpjCertificado: true,
      },
    });

    let alertsCreated = 0;
    for (const cert of certs) {
      const days = daysBetween(now, cert.notAfter);
      const classification = computeTier(days);
      if (!classification) continue;

      // Check-then-upsert para tracking confiável de "novos" vs "existentes".
      // BullMQ garante 1 worker por job (lock), então a race window aqui é
      // desprezível; mesmo assim, se acontecer, o `@@unique([certificadoId,
      // tier])` defendido no banco previne duplicação — upsert vira update.
      const existed = await this.prisma.alertaCertificado.findFirst({
        where: {
          certificadoId: cert.id,
          tier: classification.tier,
        },
        select: { id: true },
      });

      // Upsert com @@unique([certificadoId, tier]) — idempotência.
      await this.prisma.alertaCertificado.upsert({
        where: {
          certificadoId_tier: {
            certificadoId: cert.id,
            tier: classification.tier,
          },
        },
        create: {
          tenantId: cert.tenantId,
          certificadoId: cert.id,
          tier: classification.tier,
          severity: classification.severity,
          diasRestantes: days,
        },
        update: {
          // Atualiza diasRestantes para refletir o valor atual; mantém
          // geradoEm e resolvido inalterados (não re-acorda alerta resolvido).
          diasRestantes: days,
        },
      });

      if (!existed) {
        alertsCreated++;
      }
    }

    this.logger.log({
      action: 'cert.expiration.sweep',
      processed: certs.length,
      alertsCreated,
      // tenantIdPrefix/cnpjPrefix omitidos no nível agregado — log per-cert
      // só em debug seria poluição. Pino redact protege se devs adicionarem.
    });

    return { processed: certs.length, alertsCreated };
  }
}
