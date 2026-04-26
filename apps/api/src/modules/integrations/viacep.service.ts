import { Injectable, Logger } from '@nestjs/common';
import { BusinessException, NotFoundResourceException } from '../../common/business.exception';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { PrismaService } from '../../db/prisma.service';

/**
 * ViaCepService — integração com ViaCEP (Plan 02-03 Task 2, CAD-03).
 *
 * Particularidade ViaCEP: status 200 com `{ erro: true }` quando CEP não existe
 * — convertemos para NotFoundResourceException explicitamente.
 *
 * Cache TTL = 90 dias (CEPs raramente mudam). Timeout = 3000ms.
 *
 * Defesa SSRF: hardcoded host whitelist + cep sanitizado para 8 dígitos antes
 * de concatenar na URL (T-02-03-02).
 */

const VIACEP_BASE_URL = 'https://viacep.com.br/ws';
const ALLOWED_HOST_PREFIX = 'https://viacep.com.br/';
const CACHE_TTL_DAYS = 90;
const FETCH_TIMEOUT_MS = 3000;

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  /** ViaCEP retorna `{ erro: true }` (status 200) quando CEP inexistente. */
  erro?: boolean;
}

export interface NormalizedCepPayload {
  cep: string;
  logradouro: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  ibge: string | null;
}

@Injectable()
export class ViaCepService {
  private readonly logger = new Logger(ViaCepService.name);

  constructor(private readonly prisma: PrismaService) {}

  async fetchCep(rawCep: string): Promise<NormalizedCepPayload> {
    const cep = rawCep.replace(/\D/g, '');
    if (cep.length !== 8) {
      throw new BusinessException('INVALID_CEP', 'CEP deve ter 8 dígitos', 400);
    }

    const cached = await this.prisma.cepCache.findUnique({ where: { cep } });
    if (cached && cached.expiresAt > new Date()) {
      this.logger.log({ cep, cacheHit: true }, 'viacep_cache_hit');
      return cached.payload as unknown as NormalizedCepPayload;
    }

    const url = `${VIACEP_BASE_URL}/${cep}/json/`;
    if (!url.startsWith(ALLOWED_HOST_PREFIX)) {
      throw new BusinessException('SSRF_BLOCKED', 'URL bloqueada', 500);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      this.logger.warn({ cep, err: String(err) }, 'viacep_fetch_error');
      throw new BusinessException(
        'UPSTREAM_TIMEOUT',
        'ViaCEP indisponível, tente novamente em instantes',
        503,
      );
    }

    if (response.status === 400) {
      // ViaCEP retorna 400 para CEPs com formato errado (mas já validamos length 8 acima).
      throw new BusinessException('INVALID_CEP', 'Formato de CEP inválido', 400);
    }
    if (!response.ok) {
      this.logger.warn({ cep, status: response.status }, 'viacep_upstream_error');
      throw new BusinessException('UPSTREAM_ERROR', `ViaCEP retornou HTTP ${response.status}`, 503);
    }

    let data: ViaCepResponse;
    try {
      data = (await response.json()) as ViaCepResponse;
    } catch (err) {
      this.logger.warn({ cep, err: String(err) }, 'viacep_invalid_json');
      throw new BusinessException('UPSTREAM_ERROR', 'Resposta inválida do ViaCEP', 503);
    }

    // ViaCEP responde 200 + { erro: true } para CEP inexistente.
    if (data.erro === true) {
      throw new NotFoundResourceException('cep', cep);
    }

    if (!data.localidade || !data.uf) {
      this.logger.warn({ cep }, 'viacep_missing_required_fields');
      throw new NotFoundResourceException('cep', cep);
    }

    const normalized: NormalizedCepPayload = {
      cep,
      logradouro: data.logradouro ? String(data.logradouro) : null,
      complemento: data.complemento ? String(data.complemento) : null,
      bairro: data.bairro ? String(data.bairro) : null,
      cidade: String(data.localidade),
      uf: String(data.uf),
      ibge: data.ibge ? String(data.ibge) : null,
    };

    const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
    try {
      await this.prisma.cepCache.upsert({
        where: { cep },
        update: {
          payload: normalized as unknown as object,
          fetchedAt: new Date(),
          expiresAt,
        },
        create: {
          cep,
          payload: normalized as unknown as object,
          expiresAt,
        },
      });
    } catch (err) {
      this.logger.warn({ cep, err: String(err) }, 'viacep_cache_write_failed');
    }

    return normalized;
  }
}
