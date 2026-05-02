import { readFileSync } from 'node:fs';
import { Injectable } from '@nestjs/common';
import { BusinessException } from '../../common/business.exception';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { PrismaService } from '../../db/prisma.service';
import { resolveFixturePath } from '../lookup/sources/fixture-resolver';

interface ScCestNcmEntry {
  cest: string;
  ncmPatterns: string[];
  ncmRaw: string;
  descricao: string;
}

interface ScCestNcmFixture {
  source: string;
  uf: 'SC';
  entries: ScCestNcmEntry[];
}

interface NcmLookupRow {
  codigo: string;
}

export interface ProdutoFiscalValidationInput {
  ncm: string;
  cest?: string | null;
}

const scCestNcmFixture = loadScCestNcmFixture();
const scCestByCode = new Map(scCestNcmFixture.entries.map((entry) => [entry.cest, entry]));

/**
 * Validação fiscal semântica para Produto.
 *
 * NCM é validado contra a tabela lookup global e precisa estar vigente
 * (`vigente_ate` nulo ou maior/igual à data corrente do banco).
 *
 * CEST x NCM usa, por ora, somente Santa Catarina: RICMS/SC-01, Anexo 1-A.
 * A tabela estadual informa NCM/SH em níveis variados (capítulo, posição,
 * subposição ou NCM completo); por isso a comparação é por prefixo normalizado.
 */
@Injectable()
export class ProdutoFiscalValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(input: ProdutoFiscalValidationInput): Promise<void> {
    const ncm = normalizeDigits(input.ncm);
    await this.assertNcmExistsAndIsVigente(ncm);

    const cest = normalizeOptionalDigits(input.cest);
    if (!cest) return;

    this.assertCestMatchesNcmInSantaCatarina(cest, ncm);
  }

  private async assertNcmExistsAndIsVigente(ncm: string): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<NcmLookupRow[]>(
      `
        SELECT codigo
        FROM ncm
        WHERE codigo = $1
          AND (vigente_ate IS NULL OR vigente_ate::date >= CURRENT_DATE)
        LIMIT 1
      `,
      ncm,
    );

    if (rows.length === 0) {
      throw new BusinessException(
        'INVALID_NCM',
        'NCM nao encontrado ou nao vigente na tabela fiscal.',
        422,
        { ncm },
      );
    }
  }

  private assertCestMatchesNcmInSantaCatarina(cest: string, ncm: string): void {
    const entry = scCestByCode.get(cest);
    if (!entry) {
      throw new BusinessException(
        'INVALID_CEST_SC',
        'CEST nao encontrado no Anexo 1-A do RICMS/SC para validacao em Santa Catarina.',
        422,
        { cest, uf: 'SC', source: scCestNcmFixture.source },
      );
    }

    const matches = entry.ncmPatterns.some((pattern) => ncm.startsWith(pattern));
    if (!matches) {
      throw new BusinessException(
        'INVALID_CEST_NCM_SC',
        'CEST incompatível com o NCM informado para Santa Catarina.',
        422,
        {
          cest,
          ncm,
          uf: 'SC',
          ncmPermitidos: entry.ncmPatterns,
          ncmOriginalFonte: entry.ncmRaw,
          descricaoFonte: entry.descricao,
          source: scCestNcmFixture.source,
        },
      );
    }
  }
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizeOptionalDigits(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  return normalizeDigits(value);
}

function loadScCestNcmFixture(): ScCestNcmFixture {
  const path = resolveFixturePath('cest-sc-ncm.json');
  return JSON.parse(readFileSync(path, 'utf-8')) as ScCestNcmFixture;
}
