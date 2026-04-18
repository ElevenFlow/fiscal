# Infra — Nexo Fiscal

Scripts e documentação de infraestrutura.

## Desenvolvimento local

Ver [infra/postgres/README.md](./postgres/README.md).

Quickstart:
```bash
# 1. Copiar template de envs
cp .env.example .env.local

# 2. Subir Postgres
docker compose up -d postgres

# 3. (Opcional) Subir pgAdmin
docker compose --profile tools up -d
```

## Produção / Staging — AWS sa-east-1

Estes comandos são executados manualmente pelo operador humano (não automatizados ainda).
Ver `docs/OPS_README.md` (Plan 08) para uso destes recursos no runtime.

### S3 Object Lock — bucket de arquivos fiscais (XMLs, DANFEs)

Compliance Mode, retenção 6 anos (72 meses), alinhado com FOUND-11:

```bash
# 1. Criar bucket com Object Lock habilitado (só na criação — irreversível)
aws s3api create-bucket \
  --bucket nexofiscal-fiscal-prod \
  --region sa-east-1 \
  --create-bucket-configuration LocationConstraint=sa-east-1 \
  --object-lock-enabled-for-bucket

# 2. Habilitar versionamento (pré-requisito do Object Lock)
aws s3api put-bucket-versioning \
  --bucket nexofiscal-fiscal-prod \
  --versioning-configuration Status=Enabled

# 3. Configurar retenção padrão: Compliance Mode, 6 anos
aws s3api put-object-lock-configuration \
  --bucket nexofiscal-fiscal-prod \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "COMPLIANCE",
        "Years": 6
      }
    }
  }'

# 4. Bloquear acesso público
aws s3api put-public-access-block \
  --bucket nexofiscal-fiscal-prod \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# 5. Server-side encryption (KMS)
aws s3api put-bucket-encryption \
  --bucket nexofiscal-fiscal-prod \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "alias/nexofiscal-prod"
      },
      "BucketKeyEnabled": true
    }]
  }'
```

### S3 — bucket de certificados A1 (.pfx cifrados)

Governance Mode (admin pode rotacionar em caso de vazamento). Retenção menor (2 anos pós-rotação):

```bash
aws s3api create-bucket \
  --bucket nexofiscal-certs-prod \
  --region sa-east-1 \
  --create-bucket-configuration LocationConstraint=sa-east-1 \
  --object-lock-enabled-for-bucket

aws s3api put-bucket-versioning \
  --bucket nexofiscal-certs-prod \
  --versioning-configuration Status=Enabled

aws s3api put-object-lock-configuration \
  --bucket nexofiscal-certs-prod \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "GOVERNANCE",
        "Years": 2
      }
    }
  }'

aws s3api put-public-access-block \
  --bucket nexofiscal-certs-prod \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

### KMS — CMK por ambiente

```bash
aws kms create-key \
  --region sa-east-1 \
  --description "Nexo Fiscal — production CMK (tenant encryption context)" \
  --key-usage ENCRYPT_DECRYPT \
  --key-spec SYMMETRIC_DEFAULT

# Criar alias
aws kms create-alias \
  --alias-name alias/nexofiscal-prod \
  --target-key-id <KEY_ID_FROM_ABOVE>

# Habilitar rotação anual
aws kms enable-key-rotation --key-id alias/nexofiscal-prod
```

### Dev/Staging

Para staging, substituir `-prod` por `-staging`. Para dev, o Plan 08 documentará uso de LocalStack ou buckets `-dev` separados com Object Lock desabilitado.

## Segurança

- Senhas em `.env.example` são SÓ para dev local. NUNCA reutilizar em staging/prod.
- `.env` e `.env.local` estão no `.gitignore` — verificar com `git status` antes de commitar.
- Produção usa AWS Secrets Manager + IAM roles (ver `docs/OPS_README.md` do Plan 08).
