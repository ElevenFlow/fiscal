import { Injectable } from '@nestjs/common';
import { create } from 'xmlbuilder2';
import { z } from 'zod';
import { BusinessException } from '../../../common/business.exception';

export const NFE_XML_NS = 'http://www.portalfiscal.inf.br/nfe';

const NfeXmlBuildSchema = z.object({
  infNFeId: z.string().regex(/^NFe\d{44}$/, 'infNFeId deve ser NFe + chave de acesso'),
  infNFe: z.record(z.unknown()),
});

export type NfeXmlBuildInput = z.infer<typeof NfeXmlBuildSchema>;

@Injectable()
export class NfeXmlBuilderService {
  build(input: NfeXmlBuildInput): string {
    const parsed = NfeXmlBuildSchema.safeParse(input);
    if (!parsed.success) {
      throw new BusinessException(
        'NFE_XML_PAYLOAD_INVALID',
        'Payload interno nao contem estrutura minima para XML NF-e.',
        400,
        { issues: parsed.error.issues },
      );
    }

    return create({ version: '1.0', encoding: 'UTF-8' })
      .ele('NFe', { xmlns: NFE_XML_NS })
      .ele('infNFe', { Id: parsed.data.infNFeId, versao: '4.00' })
      .ele(parsed.data.infNFe)
      .up()
      .up()
      .end({ headless: false, prettyPrint: false });
  }
}
