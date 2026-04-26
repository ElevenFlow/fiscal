import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Auditable } from '../audit/audit.interceptor';
import { Roles } from '../rbac/roles.decorator';
import { BusinessException } from '../../common/business.exception';
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
  constructor(private readonly service: CertificadosService) {}

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
