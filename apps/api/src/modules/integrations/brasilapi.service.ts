import { Injectable, Logger } from '@nestjs/common';
import { BusinessException, NotFoundResourceException } from '../../common/business.exception';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { PrismaService } from '../../db/prisma.service';

/**
 * BrasilApiService — integração com BrasilAPI CNPJ (Plan 02-03 Task 2, CAD-03).
 *
 * Fluxo:
 *  1. Lookup `cnpj_cache` (Postgres global, sem RLS — Plan 02-01); retorna se TTL válido.
 *  2. Cache miss → fetch BrasilAPI com timeout 5s + whitelist de host (defesa SSRF T-02-03-01).
 *  3. Normaliza payload (descarta campos extras — defesa cache poisoning T-02-03-03).
 *  4. Upsert cache TTL 30 dias.
 *
 * Erros mapeados:
 *  - 404 BrasilAPI → NotFoundResourceException('cnpj', cnpj)
 *  - 429 BrasilAPI → BusinessException('UPSTREAM_RATE_LIMIT', 429)
 *  - timeout/network → BusinessException('UPSTREAM_TIMEOUT', 503)
 *  - !ok genérico → BusinessException('UPSTREAM_ERROR', 503)
 *  - cnpj malformado → BusinessException('INVALID_CNPJ', 400)
 *
 * NÃO usar fora de IntegrationsController: rate limit (Phase 7) será aplicado no controller.
 */

const BRASILAPI_BASE_URL = 'https://brasilapi.com.br/api/cnpj/v1';
const ALLOWED_HOST_PREFIX = 'https://brasilapi.com.br/';
const CACHE_TTL_DAYS = 30;
const FETCH_TIMEOUT_MS = 5000;

interface BrasilApiCnpjResponse {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  situacao_cadastral?: number;
  descricao_situacao_cadastral?: string;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  ddd_telefone_1?: string;
  email?: string;
  opcao_pelo_simples?: boolean;
}

export interface NormalizedCnpjPayload {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacao: string;
  cnae: string;
  cnaeDescricao: string | null;
  endereco: {
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
  };
  telefone: string | null;
  email: string | null;
  optanteSimples: boolean | null;
}

@Injectable()
export class BrasilApiService {
  private readonly logger = new Logger(BrasilApiService.name);

  constructor(private readonly prisma: PrismaService) {}

  async fetchCnpj(rawCnpj: string): Promise<NormalizedCnpjPayload> {
    const cnpj = rawCnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      throw new BusinessException('INVALID_CNPJ', 'CNPJ deve ter 14 dígitos', 400);
    }

    // 1. Cache lookup. cnpj_cache é global (sem RLS) — não precisa de withTenantContext.
    const cached = await this.prisma.cnpjCache.findUnique({ where: { cnpj } });
    if (cached && cached.expiresAt > new Date()) {
      this.logger.log(
        { cnpjPrefix: cnpj.slice(0, 8), cacheHit: true },
        'brasilapi_cache_hit',
      );
      return cached.payload as unknown as NormalizedCnpjPayload;
    }

    // 2. Constrói URL e valida host (defesa SSRF — T-02-03-01).
    // O cnpj já está sanitizado para apenas dígitos, então o template é seguro.
    // Mesmo assim, conferimos o startsWith literal antes de chamar fetch.
    const url = `${BRASILAPI_BASE_URL}/${cnpj}`;
    if (!url.startsWith(ALLOWED_HOST_PREFIX)) {
      throw new BusinessException('SSRF_BLOCKED', 'URL bloqueada', 500);
    }

    // 3. Fetch com timeout + AbortSignal.
    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      this.logger.warn(
        { cnpjPrefix: cnpj.slice(0, 8), err: String(err) },
        'brasilapi_fetch_error',
      );
      throw new BusinessException(
        'UPSTREAM_TIMEOUT',
        'BrasilAPI indisponível, tente novamente em instantes',
        503,
      );
    }

    if (response.status === 404) {
      throw new NotFoundResourceException('cnpj', cnpj);
    }
    if (response.status === 429) {
      throw new BusinessException(
        'UPSTREAM_RATE_LIMIT',
        'Muitas consultas à BrasilAPI, aguarde antes de tentar novamente',
        429,
      );
    }
    if (!response.ok) {
      this.logger.warn(
        { cnpjPrefix: cnpj.slice(0, 8), status: response.status },
        'brasilapi_upstream_error',
      );
      throw new BusinessException(
        'UPSTREAM_ERROR',
        `BrasilAPI retornou HTTP ${response.status}`,
        503,
      );
    }

    let data: BrasilApiCnpjResponse;
    try {
      data = (await response.json()) as BrasilApiCnpjResponse;
    } catch (err) {
      this.logger.warn(
        { cnpjPrefix: cnpj.slice(0, 8), err: String(err) },
        'brasilapi_invalid_json',
      );
      throw new BusinessException('UPSTREAM_ERROR', 'Resposta inválida da BrasilAPI', 503);
    }

    const normalized = this.normalize(cnpj, data);

    // 4. Persiste no cache. Apenas o resultado normalizado vai pro DB
    // (defesa T-02-03-03: campos extras do upstream são descartados).
    const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
    try {
      await this.prisma.cnpjCache.upsert({
        where: { cnpj },
        update: {
          payload: normalized as unknown as object,
          fetchedAt: new Date(),
          expiresAt,
        },
        create: {
          cnpj,
          payload: normalized as unknown as object,
          expiresAt,
        },
      });
    } catch (err) {
      // Falha de cache não deve derrubar a request — só loga.
      this.logger.warn(
        { cnpjPrefix: cnpj.slice(0, 8), err: String(err) },
        'brasilapi_cache_write_failed',
      );
    }

    return normalized;
  }

  private normalize(cnpj: string, d: BrasilApiCnpjResponse): NormalizedCnpjPayload {
    return {
      cnpj,
      razaoSocial: String(d.razao_social ?? ''),
      nomeFantasia: d.nome_fantasia ? String(d.nome_fantasia) : null,
      situacao: d.descricao_situacao_cadastral
        ? String(d.descricao_situacao_cadastral)
        : d.situacao_cadastral !== undefined
          ? String(d.situacao_cadastral)
          : 'DESCONHECIDA',
      cnae: d.cnae_fiscal !== undefined ? String(d.cnae_fiscal).padStart(7, '0') : '',
      cnaeDescricao: d.cnae_fiscal_descricao ? String(d.cnae_fiscal_descricao) : null,
      endereco: {
        cep: d.cep ? String(d.cep).replace(/\D/g, '') : null,
        logradouro: d.logradouro ? String(d.logradouro) : null,
        numero: d.numero ? String(d.numero) : null,
        complemento: d.complemento ? String(d.complemento) : null,
        bairro: d.bairro ? String(d.bairro) : null,
        cidade: d.municipio ? String(d.municipio) : null,
        uf: d.uf ? String(d.uf) : null,
      },
      telefone: d.ddd_telefone_1 ? String(d.ddd_telefone_1) : null,
      email: d.email ? String(d.email) : null,
      optanteSimples: typeof d.opcao_pelo_simples === 'boolean' ? d.opcao_pelo_simples : null,
    };
  }
}
