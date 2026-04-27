# 04 — Armazenamento S3 + Object Lock

## Visão geral

Todo artefato fiscal (XML autorizado, DANFE/DANFSE, certificado A1) é gravado no AWS S3 (`sa-east-1`) com **Object Lock em modo COMPLIANCE**, retenção:

- **6 anos** para documentos fiscais (XML, DANFE, DANFSE) — alinhado com 5 anos legais + 1 ano de margem.
- **2 anos** para certificados A1 (.pfx cifrado) — vida útil + auditoria.

Em modo COMPLIANCE, nem o root da conta AWS pode apagar antes do prazo. Compliance fiscal de 5+ anos garantido pela infraestrutura.

## Status atual

| Componente | Status |
|-----------|--------|
| `S3Service` (upload/download/presign) | Complete |
| `ObjectLockVerifier` (bootstrap fail-closed em prod) | Complete |
| Tenant prefix guard (anti-IDOR de chave) | Complete |
| Encriptação SSE-KMS opcional (`AWS_KMS_KEY_ID`) | Complete (opcional) |
| Bucket provisionado em `sa-east-1` com Object Lock | **Operacional** (planejado por env) |
| Envelope encryption do .pfx (KMS data key por tenant) | Planejado |
| Lifecycle policy (Glacier após 1 ano) | Planejado |

## Arquivos envolvidos

### Backend (apps/api)
- `src/modules/storage/storage.module.ts`
- `src/modules/storage/s3.service.ts` — `uploadFiscalDocument()`, `downloadFiscalDocument()`, `uploadCertificate()`, `generatePresignedUrl()`
- `src/modules/storage/s3.types.ts` — tipos compartilhados
- `src/modules/storage/object-lock-verifier.ts` — valida bucket no bootstrap

### Docs
- `docs/OPS_README.md` — runbook AWS CLI (criação de bucket + policy)
- `infra/README.md` — overview infra

## Variáveis de ambiente

```env
AWS_REGION=sa-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=nexofiscal-fiscal              # documentos fiscais
AWS_S3_CERTS_BUCKET=nexofiscal-certs         # certificados A1
AWS_KMS_KEY_ID=alias/nexofiscal-prod         # opcional, ativa SSE-KMS
STRICT_OBJECT_LOCK=true                       # prod: fail-closed; dev: false
```

## Convenção de chaves

```
{tenantId}/{kind}/{yyyy}/{mm}/{ulid}.{ext}
```

| `kind` | Conteúdo | Bucket | Retenção |
|--------|----------|--------|----------|
| `nfe-xml` | NF-e autorizada | fiscal | 6 anos |
| `nfe-pdf` | DANFE PDF | fiscal | 6 anos |
| `nfse-xml` | NFS-e (quando o município retorna) | fiscal | 6 anos |
| `nfse-pdf` | DANFSE PDF | fiscal | 6 anos |
| `import-xml` | XML de compra recebido | fiscal | 6 anos |
| `cert` | .pfx cifrado | certs | 2 anos |

> **Tenant prefix guard:** o service valida que `key.startsWith(`${tenantId}/`)` antes de baixar/presignar. Bloqueia tentativa de manipulação de path para acessar arquivo de outro tenant.

## API

### Upload de documento fiscal
```ts
const { key, versionId, retainUntil } = await this.s3.uploadFiscalDocument({
  tenantId: empresa.tenantId,
  kind: 'nfe-xml',
  body: xmlBuffer,
  contentType: 'application/xml',
  metadata: { chaveAcesso: '35260...' },
});
```

`retainUntil` é o timestamp de liberação do Object Lock — gravado em coluna do banco para visibilidade.

### Download (apenas backend)
```ts
const buffer = await this.s3.downloadFiscalDocument({
  tenantId,
  key,  // sempre validar startsWith(tenantId)
});
```

### Presigned URL (entregar ao browser)
```ts
const url = await this.s3.generatePresignedUrl({
  tenantId,
  key,
  expiresInSeconds: 300,  // 5 min — curto
});
```

### Upload de certificado A1
```ts
await this.s3.uploadCertificate({
  tenantId,
  pfxBuffer,           // cifrado em envelope ANTES (KMS)
  pfxPasswordEncrypted,
  fingerprint,
});
```

> O `.pfx` **nunca** é gravado em claro. Cifre com KMS data key (envelope encryption) **antes** de chamar o service.

## Fluxo Object Lock

1. PUT no bucket com `ObjectLockMode='COMPLIANCE'` + `ObjectLockRetainUntilDate=NOW + 6yr`.
2. S3 grava versão imutável.
3. Atualizar uma versão = nova versionId; versão anterior continua imutável até retainUntil.
4. DELETE silencioso até retainUntil falha com 403.

## Bootstrap — `ObjectLockVerifier`

Ao subir, o módulo:
1. `getBucketVersioning()` — exige `Status=Enabled`.
2. `getObjectLockConfiguration()` — exige `ObjectLockEnabled=Enabled` + `Mode=COMPLIANCE`.
3. Em produção (`STRICT_OBJECT_LOCK=true`), falha o boot se qualquer check falhar (fail-closed).
4. Em dev, apenas warn.

## Estratégia de chave .pfx (envelope encryption — planejado)

```
1. Gerar data key via KMS (CMK por tenant).
2. Cifrar pfxBuffer com a data key (AES-256-GCM).
3. Gravar { ciphertext, encryptedDataKey, iv, authTag } no S3.
4. Guardar fingerprint do certificado em DB.

Para usar:
1. Buscar { ciphertext, encryptedDataKey, ... } do S3.
2. Decifrar data key via KMS Decrypt.
3. Decifrar pfxBuffer em memória (TTL 30 min em cache, nunca em disco).
```

CMK por tenant isola o **blast radius** de um vazamento.

## Bibliotecas

| Pacote | Versão | Papel |
|--------|--------|-------|
| `@aws-sdk/client-s3` | 3.x | Upload/download/presign |
| `@aws-sdk/client-kms` | 3.x | Envelope encryption |
| `@aws-sdk/s3-request-presigner` | 3.x | URLs assinadas |

## Padrões e ressalvas

- **DANFE/DANFSE são representação visual** — fonte de verdade é o XML. Re-renderize sob demanda; não dependa do PDF para auditoria.
- **Pré-asignados curtos** (5 min). Não envie por e-mail uma URL de 24 h.
- **Logue todo download** em `audit_log` (`action: 'storage.download'`).
- **Nunca grave .pfx em filesystem da instância EC2.** Perdeu ao auto-scalar.
- **Retenção do bucket > retenção legal.** Se a lei mudar para 7 anos, o bucket atual ainda serve (Object Lock só extende, nunca encurta).
- **Custo:** documentos pequenos (XML < 50 KB) cabem em S3 Standard. Após 1 ano, mover para S3 Standard-IA via lifecycle.
- **Versioning ativo** — atualizações geram novas versões; deletes geram delete markers (também imutáveis sob compliance).

## Provisionamento (runbook resumido)

Comandos AWS CLI completos em `docs/OPS_README.md`. Resumo:

```bash
aws s3api create-bucket --bucket nexofiscal-fiscal \
  --region sa-east-1 \
  --create-bucket-configuration LocationConstraint=sa-east-1 \
  --object-lock-enabled-for-bucket

aws s3api put-bucket-versioning --bucket nexofiscal-fiscal \
  --versioning-configuration Status=Enabled

aws s3api put-object-lock-configuration --bucket nexofiscal-fiscal \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "COMPLIANCE",
        "Days": 2190
      }
    }
  }'
```

## Próximos passos

- [ ] Envelope encryption do .pfx (rotina de [14-configuracoes.md](14-configuracoes.md))
- [ ] Lifecycle: Standard-IA após 90 dias, Glacier após 365 dias
- [ ] Cross-region replication para DR (sa-east-1 → us-east-1, ambos Object Lock)
- [ ] Métrica em Sentry: contagem de tentativas de download bloqueadas pelo prefix guard
- [ ] Documentar processo de *Legal Hold* (suspende deleção mesmo após retainUntil)
