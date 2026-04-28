import { Injectable } from '@nestjs/common';
import forge from 'node-forge';
import { BusinessException } from '../../../common/business.exception';

export type PfxKeyMaterial = {
  privateKeyPem: string;
  certificatePem: string;
};

@Injectable()
export class PfxKeyMaterialService {
  extract(pfxBytes: Buffer, password: string): PfxKeyMaterial {
    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
      const der = forge.util.createBuffer(pfxBytes.toString('binary'));
      const asn1 = forge.asn1.fromDer(der);
      p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      if (/password|MAC|integrity/i.test(message)) {
        throw new BusinessException(
          'INVALID_PFX_PASSWORD',
          'Senha do certificado incorreta',
          400,
        );
      }
      throw new BusinessException(
        'INVALID_PFX_FORMAT',
        'Arquivo .pfx invalido ou corrompido',
        400,
      );
    }

    const certBagOid = forge.pki.oids.certBag;
    const keyBagOid = forge.pki.oids.pkcs8ShroudedKeyBag;
    if (!certBagOid || !keyBagOid) {
      throw new BusinessException(
        'PFX_UNSUPPORTED',
        'Certificado A1 sem OIDs PKCS#12 esperados.',
        400,
      );
    }

    const cert = p12.getBags({ bagType: certBagOid })[certBagOid]?.[0]?.cert;
    const privateKey = p12.getBags({ bagType: keyBagOid })[keyBagOid]?.[0]?.key;
    if (!cert || !privateKey) {
      throw new BusinessException(
        'PFX_KEY_MATERIAL_NOT_FOUND',
        'Certificado ou chave privada nao encontrados no .pfx.',
        400,
      );
    }

    return {
      privateKeyPem: forge.pki.privateKeyToPem(privateKey),
      certificatePem: forge.pki.certificateToPem(cert),
    };
  }
}
