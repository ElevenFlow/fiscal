import { Injectable } from '@nestjs/common';
import { SignedXml } from 'xml-crypto';
import { BusinessException } from '../../../common/business.exception';
import type { PfxKeyMaterial } from './pfx-key-material.service';

const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
const SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1';

@Injectable()
export class XmlSignerService {
  signNfe(xml: string, infNFeId: string, material: PfxKeyMaterial): string {
    if (!infNFeId.startsWith('NFe')) {
      throw new BusinessException(
        'NFE_SIGNATURE_ID_INVALID',
        'Id da infNFe deve iniciar com NFe.',
        400,
      );
    }

    const certificateBody = material.certificatePem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, '');

    const signer = new SignedXml({
      privateKey: material.privateKeyPem,
      publicCert: material.certificatePem,
      canonicalizationAlgorithm: C14N,
      signatureAlgorithm: RSA_SHA1,
      idAttribute: 'Id',
      getKeyInfoContent: () =>
        `<X509Data><X509Certificate>${certificateBody}</X509Certificate></X509Data>`,
    });

    signer.addReference({
      xpath: "//*[local-name(.)='infNFe']",
      uri: `#${infNFeId}`,
      transforms: [ENVELOPED, C14N],
      digestAlgorithm: SHA1,
    });
    signer.computeSignature(xml, {
      location: {
        reference: "//*[local-name(.)='infNFe']",
        action: 'after',
      },
    });

    return signer.getSignedXml();
  }
}
