import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Auditable } from '../audit/audit.interceptor';
import { Roles } from '../rbac/roles.decorator';
import {
  BusinessException,
  NotFoundResourceException,
} from '../../common/business.exception';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { PrismaService } from '../../db/prisma.service';
import { getCurrentTenant } from '../../db/tenant-context';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { CertificadosService } from './certificados.service';

/**
 * REST endpoints — /api/certificados (Phase 2 Plan 02-04).
 *
 * RBAC (FOUND-04):
 *  - POST upload: contabilidade_owner OU empresa_owner (ação fiscal sensível).
 *  - GET list/detail: roles que enxergam dados do tenant.
 *  - DELETE (rotação): mesmo conjunto do POST.
 *
 * Audit: cada mutation gera audit_log (Plan 01-05).
 *
 * Multipart: Fastify multipart está registrado em main.ts com fileSize=100KB
 * (T-02-04-09 — DoS guard). Aqui só extraímos `file` + campo `password`.
 */
@Controller('certificados')
@Roles(
  'admin',
  'contabilidade_owner',
  'contabilidade_operador',
  'empresa_owner',
  'empresa_operador',
  'empresa_leitura',
)
export class CertificadosController {
  constructor(
    private readonly service: CertificadosService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('admin', 'contabilidade_owner', 'empresa_owner')
  @Auditable({
    action: 'cert.upload',
    resourceType: 'certificado_digital',
    resourceIdFrom: 'response.id',
  })
  async upload(@Req() req: FastifyRequest): Promise<unknown> {
    if (!req.isMultipart()) {
      throw new BusinessException(
        'NOT_MULTIPART',
        'Content-Type deve ser multipart/form-data',
        400,
      );
    }

    // Lê o multipart inteiro como single-file form. `req.file()` retorna o
    // primeiro arquivo + os campos no mesmo formData. Limites de tamanho
    // foram registrados no main.ts (fileSize: 100KB, T-02-04-09).
    const data = await req.file();
    if (!data) {
      throw new BusinessException(
        'NO_FILE',
        'Arquivo .pfx ausente no multipart',
        400,
      );
    }

    if (!/\.(pfx|p12)$/i.test(data.filename ?? '')) {
      throw new BusinessException(
        'INVALID_FILE_TYPE',
        'Apenas arquivos .pfx ou .p12 são aceitos',
        400,
      );
    }

    const passwordField = data.fields?.['password'] as
      | { value?: string }
      | undefined;
    const password = passwordField?.value;
    if (!password) {
      throw new BusinessException(
        'MISSING_PASSWORD',
        'Senha do certificado obrigatória (campo "password" no multipart)',
        400,
      );
    }

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      // @fastify/multipart lança RequestFileTooLargeError quando excede limite
      if (/file.*too.*large/i.test(message) || /limit/i.test(message)) {
        throw new BusinessException(
          'FILE_TOO_LARGE',
          'Arquivo .pfx excede 100KB',
          413,
        );
      }
      throw err;
    }

    return this.service.uploadCertificate(buffer, password);
  }

  @Get()
  list(): Promise<unknown[]> {
    return this.service.listCertificates();
  }

  // ==========================================================================
  // Plan 02-05 — Alertas de vencimento de certificado.
  //
  // ROTAS DE LISTA/AÇÃO ESTÁTICA DEVEM SER DECLARADAS ANTES DE @Get(':id') —
  // NestJS roteia na ordem de declaração; sem isso, GET /certificados/alertas
  // seria capturado por GET /certificados/:id com id="alertas".
  // ==========================================================================

  /**
   * GET /api/certificados/alertas — lista alertas não-resolvidos do tenant.
   *
   * Retorna ordenado por severity DESC + geradoEm DESC. RLS filtra por
   * tenant; o WHERE explícito é defesa em camadas (também ajuda quando o
   * dev rodando local sem tenant ativo recebe array vazio).
   *
   * Consumido pela Central de Alertas (Phase 6) e badge no header.
   */
  @Get('alertas')
  @Roles(
    'admin',
    'contabilidade_owner',
    'contabilidade_operador',
    'empresa_owner',
    'empresa_operador',
    'empresa_leitura',
  )
  async listAlertas(): Promise<unknown[]> {
    const scope = getCurrentTenant();
    const tenantId = scope?.tenantId ?? null;
    if (!tenantId) return [];
    return this.prisma.alertaCertificado.findMany({
      where: { tenantId, resolvido: false },
      orderBy: [{ severity: 'desc' }, { geradoEm: 'desc' }],
      include: {
        certificado: {
          select: {
            cn: true,
            cnpjCertificado: true,
            notAfter: true,
          },
        },
      },
    });
  }

  /**
   * PATCH /api/certificados/alertas/:id/resolver — marca alerta como resolvido.
   *
   * Útil quando o usuário acabou de renovar o certificado (upload novo) e
   * quer limpar o sino — alternativa a esperar o cron remover na próxima
   * varredura. Usuário deve ter perm de gestão (owner/contabilidade).
   *
   * RLS: findFirst com WHERE tenantId garante que alerta de outro tenant
   * retorna null (NotFoundResourceException) — defesa em camadas com a
   * policy do banco (T-02-05-05).
   */
  @Patch('alertas/:id/resolver')
  @HttpCode(204)
  @Roles('admin', 'contabilidade_owner', 'empresa_owner')
  @Auditable({
    action: 'cert.alerta.resolve',
    resourceType: 'alerta_certificado',
    resourceIdFrom: 'params.id',
  })
  async resolverAlerta(@Param('id') id: string): Promise<void> {
    const scope = getCurrentTenant();
    const tenantId = scope?.tenantId ?? null;
    const alerta = await this.prisma.alertaCertificado.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!alerta) {
      throw new NotFoundResourceException('alerta', id);
    }
    if (alerta.resolvido) return; // idempotente — já resolvido, sem-op
    await this.prisma.alertaCertificado.update({
      where: { id },
      data: { resolvido: true, resolvidoEm: new Date() },
    });
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<unknown> {
    return this.service.getCertificate(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin', 'contabilidade_owner', 'empresa_owner')
  @Auditable({
    action: 'cert.deactivate',
    resourceType: 'certificado_digital',
    resourceIdFrom: 'params.id',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.deactivateCertificate(id);
  }
}
