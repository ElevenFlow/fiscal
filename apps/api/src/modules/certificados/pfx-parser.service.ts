import { Injectable, Logger } from '@nestjs/common';
import forge from 'node-forge';
import { BusinessException } from '../../common/business.exception';

/**
 * Certificado A1 (.pfx/.p12) parsado — metadados estritamente públicos
 * (zero material de chave privada). Phase 2 Plan 02-04.
 */
export interface ParsedCertificate {
  /** CommonName completo extraído do subject. */
  cn: string;
  /** 14 dígitos quando o subject ICP-Brasil termina em ":CNPJ"; senão null. */
  cnpjCertificado: string | null;
  /** SHA-256 hex lowercase do DER do certificado X.509. 64 chars. */
  fingerprint: string;
  /** Início da validade (UTC). */
  notBefore: Date;
  /** Fim da validade (UTC). */
  notAfter: Date;
}

/**
 * PfxParserService — parsing seguro de PKCS#12 via node-forge.
 *
 * Garantias:
 *  - Parse falha fechado em senha errada / formato inválido / cert vencido.
 *  - Fingerprint determinístico (SHA-256 do DER), usado para detecção de
 *    upload duplicado por tenant (CertificadosService).
 *  - Senha do .pfx é argumento de método — fica em scope local; service
 *    não persiste a senha em lugar nenhum.
 *  - Valida cert NÃO vencido durante o parse — Wave 3 (alertas) cuida do
 *    "vencendo em D-X"; aqui o cut-off é ON/OFF.
 *
 * Threats cobertos:
 *  - T-02-04-05 (zip-bomb / path-traversal): tamanho é limitado pelo caller
 *    (CertificadosService rejeita > 100KB antes de chegar aqui).
 *  - T-02-04-07 (senha em stack trace): BusinessException nunca propaga a
 *    senha no message; só códigos estruturados (INVALID_PFX_PASSWORD/FORMAT).
 */
@Injectable()
export class PfxParserService {
  private readonly logger = new Logger(PfxParserService.name);

  parsePfx(pfxBytes: Buffer, password: string): ParsedCertificate {
    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
      // node-forge espera string "binary" (latin1) — converter via toString('binary')
      // ou createBuffer(Buffer) que aceita Uint8Array.
      const der = forge.util.createBuffer(pfxBytes.toString('binary'));
      const asn1 = forge.asn1.fromDer(der);
      p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      // node-forge emite "Invalid password" ou erros de MAC/integridade quando
      // a senha está incorreta. Distingue de bytes simplesmente corrompidos
      // para devolver erro melhor ao usuário.
      if (/password/i.test(message) || /MAC/i.test(message) || /integrity/i.test(message)) {
        throw new BusinessException(
          'INVALID_PFX_PASSWORD',
          'Senha do certificado incorreta',
          400,
        );
      }
      throw new BusinessException(
        'INVALID_PFX_FORMAT',
        'Arquivo .pfx inválido ou corrompido',
        400,
      );
    }

    const certBagOid = forge.pki.oids.certBag;
    if (!certBagOid) {
      throw new BusinessException(
        'CERT_NO_CERTIFICATE',
        'Certificado não encontrado no .pfx',
        400,
      );
    }
    const certBags = p12.getBags({ bagType: certBagOid });
    const certBag = certBags[certBagOid]?.[0];
    if (!certBag?.cert) {
      throw new BusinessException(
        'CERT_NO_CERTIFICATE',
        'Certificado não encontrado no .pfx',
        400,
      );
    }
    const cert = certBag.cert;

    const cnField = cert.subject.getField('CN');
    if (!cnField?.value) {
      throw new BusinessException(
        'CERT_NO_CN',
        'CommonName não encontrado no certificado',
        400,
      );
    }
    const cn = String(cnField.value);

    const cnpjCertificado = this.extractCnpj(cn);

    // Fingerprint = SHA-256 hex do DER do certificado (não do .pfx inteiro).
    // node-forge retorna ByteBuffer com bytes binários; toHex() devolve hex lowercase.
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const md = forge.md.sha256.create();
    md.update(certDer);
    const fingerprint = md.digest().toHex();

    const notBefore = cert.validity.notBefore;
    const notAfter = cert.validity.notAfter;

    if (notAfter.getTime() < Date.now()) {
      throw new BusinessException(
        'CERT_EXPIRED',
        'Certificado já vencido',
        400,
        { notAfter: notAfter.toISOString() },
      );
    }

    return { cn, cnpjCertificado, fingerprint, notBefore, notAfter };
  }

  /**
   * ICP-Brasil e-CNPJ — CN segue padrão "RAZAO SOCIAL:14digitos".
   * Ex: "NEXO LTDA:11222333000181" → "11222333000181"
   * e-CPF (11 dígitos) e certs auto-assinados não-padrão retornam null.
   */
  private extractCnpj(cn: string): string | null {
    const m = /:(\d{14})$/.exec(cn);
    return m && m[1] ? m[1] : null;
  }
}
