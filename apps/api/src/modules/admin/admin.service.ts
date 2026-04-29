import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AuditoriaQuery,
  ConfiguracaoEmpresaInput,
  ConfiguracaoPreferenciasInput,
  ConfiguracaoTemplateEmailInput,
  UsuarioAcaoInput,
  UsuarioCreateInput,
  UsuariosQuery,
  UsuarioUpdateInput,
} from '@nexo/shared';
import { BusinessException, NotFoundResourceException } from '../../common/business.exception';
import { PrismaService } from '../../db/prisma.service';
import { getCurrentTenant, requireTenant } from '../../db/tenant-context';

type ConfigJson = {
  emailTemplate?: ConfiguracaoTemplateEmailInput;
  preferencias?: ConfiguracaoPreferenciasInput;
};

const DEFAULT_EMAIL: ConfiguracaoTemplateEmailInput = {
  assunto: 'Documento fiscal {{numero_nota}} - {{empresa}}',
  remetente: 'notas@nexofiscal.com.br',
  ccPadrao: null,
  corpo:
    'Olá {{nome_destinatario}},\n\nSegue o documento fiscal {{numero_nota}} no valor de {{valor}}.\n\nAtenciosamente,\n{{empresa}}',
};

const DEFAULT_PREFS: ConfiguracaoPreferenciasInput = {
  formatoData: 'BR',
  tema: 'claro',
  notificacoes: { email: true, push: false, sino: true },
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfiguracoes(): Promise<unknown> {
    const tenantId = this.requireTenantId();
    const [empresa, certificados, series] = await Promise.all([
      this.prisma.empresa.findUnique({ where: { tenantId } }),
      this.prisma.certificadoDigital.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.serieFiscal.findMany({
        where: { tenantId },
        orderBy: [{ modelo: 'asc' }, { serie: 'asc' }],
      }),
    ]);
    if (!empresa) throw new NotFoundResourceException('empresa', tenantId);
    const config = this.configFromEmpresa(empresa.contatos);
    return {
      empresa,
      emailTemplate: config.emailTemplate ?? DEFAULT_EMAIL,
      preferencias: config.preferencias ?? DEFAULT_PREFS,
      certificados,
      series: series.map((serie) => ({
        ...serie,
        proximoNumero: serie.proximoNumero.toString(),
      })),
      hardening: this.hardeningChecklist(),
    };
  }

  async updateEmpresa(dto: ConfiguracaoEmpresaInput): Promise<unknown> {
    const tenantId = this.requireTenantId();
    const data: Prisma.EmpresaUpdateInput = {};
    if (dto.razaoSocial !== undefined) data.razaoSocial = dto.razaoSocial;
    if (dto.nomeFantasia !== undefined) data.nomeFantasia = dto.nomeFantasia;
    if (dto.ie !== undefined) data.ie = dto.ie;
    if (dto.im !== undefined) data.im = dto.im;
    if (dto.cnae !== undefined) data.cnae = dto.cnae;
    if (dto.regimeTributario !== undefined) data.regimeTributario = dto.regimeTributario;
    if (dto.endereco !== undefined) data.endereco = dto.endereco as Prisma.InputJsonValue;
    if (dto.contatos !== undefined) {
      const current = await this.currentEmpresa();
      data.contatos = {
        ...this.recordFromJson(current.contatos),
        ...dto.contatos,
      } as Prisma.InputJsonValue;
    }
    return this.prisma.empresa.update({ where: { tenantId }, data });
  }

  async updateEmail(dto: ConfiguracaoTemplateEmailInput): Promise<unknown> {
    const empresa = await this.currentEmpresa();
    const contatos = this.recordFromJson(empresa.contatos);
    const nexoConfig = this.configFromEmpresa(empresa.contatos);
    nexoConfig.emailTemplate = dto;
    return this.prisma.empresa.update({
      where: { tenantId: empresa.tenantId },
      data: { contatos: { ...contatos, nexoConfig } as Prisma.InputJsonValue },
    });
  }

  async updatePreferencias(dto: ConfiguracaoPreferenciasInput): Promise<unknown> {
    const empresa = await this.currentEmpresa();
    const contatos = this.recordFromJson(empresa.contatos);
    const nexoConfig = this.configFromEmpresa(empresa.contatos);
    nexoConfig.preferencias = dto;
    return this.prisma.empresa.update({
      where: { tenantId: empresa.tenantId },
      data: { contatos: { ...contatos, nexoConfig } as Prisma.InputJsonValue },
    });
  }

  async listUsuarios(query: UsuariosQuery): Promise<unknown[]> {
    const where: Prisma.UserWhereInput = {};
    if (query.search) {
      where.email = { contains: query.search, mode: 'insensitive' };
    }
    const users = await this.prisma.user.findMany({
      where,
      include: {
        memberships: { orderBy: { createdAt: 'desc' }, take: 5 },
        sessions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return users
      .map((user) => {
        const membership = user.memberships[0];
        const status = this.usuarioStatus(user, membership?.role);
        return {
          id: user.id,
          nome: this.nameFromEmail(user.email),
          email: user.email,
          role: membership?.role ?? 'sem_perfil',
          scopeType: membership?.scopeType ?? null,
          scopeId: membership?.scopeId ?? null,
          status,
          ultimoAcesso: user.sessions[0]?.createdAt?.toISOString() ?? null,
          criadoEm: user.createdAt.toISOString(),
        };
      })
      .filter((user) => (query.status ? user.status === query.status : true))
      .filter((user) => (query.role ? user.role === query.role : true));
  }

  async createUsuario(dto: UsuarioCreateInput): Promise<unknown> {
    const user = await this.prisma.user.upsert({
      where: { email: dto.email },
      update: {},
      create: { email: dto.email, emailVerifiedAt: null },
    });
    await this.upsertMembership(user.id, dto);
    return {
      id: user.id,
      email: user.email,
      nome: dto.nome,
      role: dto.role,
      status: 'convidado',
      conviteEnviado: false,
      pendencia: dto.enviarConvite ? 'PEND-025' : null,
    };
  }

  async updateUsuario(id: string, dto: UsuarioUpdateInput): Promise<unknown> {
    await this.ensureUser(id);
    if (dto.role) {
      await this.upsertMembership(id, {
        role: dto.role,
        scopeType: dto.scopeType ?? 'empresa',
        scopeId: dto.scopeId ?? getCurrentTenant()?.tenantId ?? null,
      });
    }
    return { id, updated: true };
  }

  async usuarioAcao(id: string, dto: UsuarioAcaoInput): Promise<unknown> {
    await this.ensureUser(id);
    if (dto.acao === 'bloquear') {
      await this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const membership = await this.prisma.userMembership.findFirst({ where: { userId: id } });
      if (membership && !membership.role.startsWith('bloqueado:')) {
        await this.prisma.userMembership.update({
          where: { id: membership.id },
          data: { role: `bloqueado:${membership.role}` },
        });
      }
      return { id, status: 'bloqueado' };
    }
    if (dto.acao === 'desbloquear') {
      const membership = await this.prisma.userMembership.findFirst({ where: { userId: id } });
      if (membership?.role.startsWith('bloqueado:')) {
        await this.prisma.userMembership.update({
          where: { id: membership.id },
          data: { role: membership.role.replace(/^bloqueado:/, '') },
        });
      }
      return { id, status: 'ativo' };
    }
    return {
      id,
      executado: false,
      pendencia: 'PEND-025',
      message: 'Envio de e-mail transacional será ligado quando o provedor for definido.',
    };
  }

  async listAuditoria(query: AuditoriaQuery): Promise<unknown[]> {
    const tenant = getCurrentTenant();
    const where: Prisma.AuditLogWhereInput = {};
    if (tenant?.tenantId) where.tenantId = tenant.tenantId;
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
    if (query.resourceType) where.resourceType = query.resourceType;
    if (query.result) where.result = query.result;
    if (query.dataInicio || query.dataFim) {
      where.createdAt = {};
      if (query.dataInicio) where.createdAt.gte = new Date(query.dataInicio);
      if (query.dataFim) where.createdAt.lte = new Date(query.dataFim);
    }
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return rows
      .map((row) => ({
        id: row.id,
        usuario: row.userId ?? 'sistema',
        userId: row.userId,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        diff: row.diff,
        ip: row.ip,
        userAgent: row.userAgent,
        result: row.result,
        createdAt: row.createdAt.toISOString(),
      }))
      .filter((row) => {
        if (!query.search) return true;
        const term = query.search.toLowerCase();
        return [row.usuario, row.action, row.resourceType, row.resourceId, row.ip]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .filter((row) => (query.usuario ? row.usuario === query.usuario : true));
  }

  private async currentEmpresa() {
    const tenantId = this.requireTenantId();
    const empresa = await this.prisma.empresa.findUnique({ where: { tenantId } });
    if (!empresa) throw new NotFoundResourceException('empresa', tenantId);
    return empresa;
  }

  private requireTenantId(): string {
    const { tenantId } = requireTenant();
    if (!tenantId) {
      throw new BusinessException('NO_TENANT', 'Empresa ativa requerida para configurações.', 400);
    }
    return tenantId;
  }

  private recordFromJson(value: Prisma.JsonValue): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private configFromEmpresa(value: Prisma.JsonValue): ConfigJson {
    const contatos = this.recordFromJson(value);
    const config = contatos.nexoConfig;
    return typeof config === 'object' && config !== null && !Array.isArray(config)
      ? (config as ConfigJson)
      : {};
  }

  private async ensureUser(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundResourceException('usuario', id);
  }

  private async upsertMembership(
    userId: string,
    dto: Pick<UsuarioCreateInput, 'role' | 'scopeType' | 'scopeId'>,
  ): Promise<void> {
    const current = await this.prisma.userMembership.findFirst({ where: { userId } });
    const scopeId =
      dto.scopeType === 'platform' ? null : (dto.scopeId ?? getCurrentTenant()?.tenantId ?? null);
    if (current) {
      await this.prisma.userMembership.update({
        where: { id: current.id },
        data: { role: dto.role, scopeType: dto.scopeType, scopeId },
      });
      return;
    }
    await this.prisma.userMembership.create({
      data: { userId, role: dto.role, scopeType: dto.scopeType, scopeId },
    });
  }

  private usuarioStatus(
    user: { passwordHash: string | null; emailVerifiedAt: Date | null },
    role?: string,
  ): 'ativo' | 'convidado' | 'bloqueado' {
    if (role?.startsWith('bloqueado:')) return 'bloqueado';
    if (!user.passwordHash || !user.emailVerifiedAt) return 'convidado';
    return 'ativo';
  }

  private nameFromEmail(email: string): string {
    const local = email.split('@')[0] ?? email;
    return local
      .split(/[._-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private hardeningChecklist() {
    return [
      {
        id: 'auth-rate-limit',
        label: 'Rate limit em autenticação',
        status: 'pendente',
        pendencia: 'PEND-010',
      },
      { id: 'csrf', label: 'Proteção CSRF explícita', status: 'pendente', pendencia: 'PEND-011' },
      {
        id: 'rls-sessions',
        label: 'RLS restritiva em sessões',
        status: 'pendente',
        pendencia: 'PEND-012',
      },
      { id: 'audit-ui', label: 'Auditoria consultável na UI', status: 'entregue' },
      { id: 'pino-redact', label: 'Redação de dados sensíveis em logs', status: 'entregue' },
    ];
  }
}
