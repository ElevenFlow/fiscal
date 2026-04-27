# 14 — Configurações

## Visão geral

Tela de configurações da empresa (e da contabilidade). Abas:

1. **Perfil da empresa** — razão social, CNPJ, endereço, regime tributário, IE/IM, CNAE.
2. **Certificado A1 (.pfx)** — upload cifrado, fingerprint, validade, alertas de vencimento.
3. **Séries fiscais** — séries de NF-e e RPS de NFS-e configuradas, próximo número.
4. **Webhooks** — URLs externas para receber eventos (`nota.autorizada`, `nota.denegada`, etc.).
5. **API tokens** — chaves para integração externa (token + escopo).
6. **Notificações** — preferências de e-mail/WhatsApp por severidade de alerta.
7. **Branding** — logo + cor para DANFSE custom (futuro).
8. **Plano e cobrança** — futuro (Stripe).

A aba mais crítica é **Certificado A1** — fonte do risco "vazamento criminal".

## Status atual

**Scaffolded.** Página placeholder.

## Arquivos envolvidos

### Frontend (apps/web)
- `src/app/(app)/config/page.tsx` — placeholder
- *(planejado)* `src/app/(app)/config/empresa/page.tsx`
- *(planejado)* `src/app/(app)/config/certificado/page.tsx`
- *(planejado)* `src/app/(app)/config/series/page.tsx`
- *(planejado)* `src/app/(app)/config/webhooks/page.tsx`
- *(planejado)* `src/app/(app)/config/api-tokens/page.tsx`
- *(planejado)* `src/app/(app)/config/notificacoes/page.tsx`

### Backend (planejado)
- `apps/api/src/modules/configuracoes/*`
- `apps/api/src/modules/cert-a1/*` — módulo dedicado por criticidade

## Modelos de dados (planejados)

### Certificado A1

```prisma
model CertA1 {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @db.Uuid @map("tenant_id")
  fingerprint   String   @unique  // SHA-256 do .pfx
  cnpj          String   // do CN do certificado
  subject       String   // CN/OU do certificado
  issuer        String
  notBefore     DateTime @map("not_before")
  notAfter      DateTime @map("not_after")  // = expiresAt
  s3Key         String   @map("s3_key")     // bucket de certs
  encryptedDek  Bytes    @map("encrypted_dek")  // data key cifrada via KMS
  iv            Bytes
  authTag       Bytes
  ativo         Boolean  @default(true)
  uploadedBy    String   @db.Uuid @map("uploaded_by")
  createdAt     DateTime @default(now())
  revogadoEm    DateTime? @map("revogado_em")
  revogadoMotivo String? @map("revogado_motivo")

  @@index([tenantId, ativo])
  @@map("cert_a1")
}
```

### Série fiscal

```prisma
model SerieFiscal {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @db.Uuid @map("tenant_id")
  tipo          String   // 'nfe' | 'nfce' | 'nfse-rps'
  serie         String
  proximoNumero Int      @map("proximo_numero")
  ambiente      String   // 'producao' | 'homologacao'
  ativa         Boolean  @default(true)
  updatedAt     DateTime @updatedAt

  @@unique([tenantId, tipo, serie, ambiente])
  @@map("serie_fiscal")
}
```

> `proximoNumero` muta com advisory lock para evitar dois jobs paralelos pegarem o mesmo número.

### Webhook

```prisma
model Webhook {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid @map("tenant_id")
  url         String
  eventos     String[] // ['nota.autorizada', 'nota.denegada', ...]
  secret      String   // HMAC compartilhado
  ativo       Boolean  @default(true)
  ultimaTentativa DateTime?
  ultimoStatus    Int?
  createdAt   DateTime @default(now())

  @@index([tenantId])
  @@map("webhooks")
}
```

### API Token

```prisma
model ApiToken {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid @map("tenant_id")
  nome        String
  prefix      String   @unique  // primeiros 8 chars (visível na UI)
  hash        String   // bcrypt do token completo
  escopos     String[] // ['notas:emit', 'notas:read', 'cadastros:read'...]
  expiraEm    DateTime?
  ultimoUso   DateTime?
  criadoPor   String   @db.Uuid
  ativo       Boolean  @default(true)
  createdAt   DateTime @default(now())

  @@index([tenantId])
  @@map("api_tokens")
}
```

## Fluxo do certificado A1 (UPLOAD CRÍTICO)

```
1. Usuário faz POST /api/config/certificado (multipart .pfx + senha)
   • HTTPS-only obrigatório
   • Limite 10 MB
2. Backend:
   a. Lê stream em memória (NUNCA toca disco)
   b. node-forge: parsePkcs12(pfxBuffer, senha)
      • Valida que decifra (senha correta)
      • Extrai certificate + privateKey + CN, validade
   c. Verifica CNPJ no certificado bate com empresa
   d. Verifica notAfter > now + 7d (recusa cert prestes a vencer)
   e. Gera DEK (data encryption key) AES-256
   f. Cifra pfxBuffer + senha com DEK (AES-256-GCM)
   g. KMS Encrypt(DEK) usando CMK do tenant → encryptedDek
   h. PUT no bucket de certs (Object Lock 2 anos)
   i. Insert CertA1
   j. Audit log com fingerprint (não com pfxBuffer)
   k. Retorna fingerprint + validade

3. Worker de emissão (futuro):
   a. Busca CertA1 ativo do tenant
   b. KMS Decrypt(encryptedDek) → DEK
   c. AES-256-GCM decifra pfxBuffer + senha
   d. Carrega em memória, usa para assinar XML
   e. Cache em memória do worker (TTL 30 min)
   f. NUNCA grava em disco
```

> ⚠️ Usuário com role `admin` ou `contabilidade_owner` pode trocar cert de qualquer empresa vinculada. `empresa_owner` só do próprio. `empresa_operador` NÃO pode upload.

## Endpoints (planejados)

| Método | Rota | Descrição | Roles |
|--------|------|-----------|-------|
| GET | `/api/config/empresa` | Dados da empresa | todos |
| PATCH | `/api/config/empresa` | Atualiza | owner+ |
| GET | `/api/config/certificado` | Metadata (sem .pfx!) | owner+ |
| POST | `/api/config/certificado` | Upload | owner+ |
| DELETE | `/api/config/certificado/:id` | Revoga (soft) | owner+ |
| GET | `/api/config/series` | Lista | owner+ |
| POST | `/api/config/series` | Criar | owner+ |
| GET | `/api/config/webhooks` | Lista | owner+ |
| POST | `/api/config/webhooks` | Criar (gera secret) | owner+ |
| POST | `/api/config/api-tokens` | Cria token (mostra UMA VEZ) | owner+ |
| DELETE | `/api/config/api-tokens/:id` | Revoga | owner+ |

## Webhook outbound (entrega de eventos)

Quando emitida/denegada/cancelada, sistema entrega POST ao webhook configurado:

```
POST {url}
X-Nexo-Event: nota.autorizada
X-Nexo-Signature: sha256={hmac_sha256(secret, body)}
X-Nexo-Timestamp: 1714045200
Content-Type: application/json

{ "evento": "nota.autorizada", "tenantId": "...", "notaId": "...", "chaveAcesso": "...", "dhEmi": "..." }
```

Retry com backoff exponencial via BullMQ; após 5 falhas, marca webhook como `inativo` e cria alerta.

## Padrões e ressalvas

### Certificado A1 — segurança máxima
- **Nunca logar** `pfxBuffer`, `pfxPassword`, `encryptedDek`, ou conteúdo de `subject` parcial.
- **Pino redact** já cobre, mas adicione no `safeLog` do controller.
- **Audit log** inclui só fingerprint (8 primeiros chars).
- **CMK por tenant** — vazamento da CMK = só esse tenant comprometido.
- **Recusar cert vencido** — `notAfter > now + 7d` mínimo.
- **Não permitir upload de cert de CNPJ diferente** da empresa (CN must match).
- **Histórico:** revogar = `ativo=false`. Manter S3 imutável até `notAfter + 2 anos` (2 anos pós-validade para auditoria de assinaturas históricas).

### Séries fiscais
- **Numeração sem buracos** — quando job falha após pegar número, tem que **inutilizar** (NF-e protocolo de inutilização, NFS-e regras municipais). Não "pular".
- **Advisory lock** em `(tenantId, tipo, serie)` para `proximoNumero++` atômico.

### Webhooks
- **HMAC sempre** — assinar com secret compartilhado.
- **Idempotência:** consumidor checa `X-Nexo-Event-Id`; nossas reentregas têm o mesmo ID.
- **Timeout 5 s** no nosso lado — webhook lento não pode segurar emissão.

### API tokens
- **Mostrar apenas uma vez.** Hash bcrypt persistido; texto plano só na resposta de criação.
- **Prefix visível** (`nfx_abc12345...`) para identificar token sem revelar.
- **Escopo mínimo:** scopes granulares (`notas:emit`, `notas:read`, `cadastros:write`, etc.).

## Bibliotecas

| Pacote | Papel |
|--------|-------|
| `node-forge` 1.3+ | Parse .pfx, validação |
| `@aws-sdk/client-kms` 3.x | Cifrar DEK |
| `bcrypt` ou `argon2` | Hash de API tokens |
| `crypto` (built-in) | HMAC para webhooks, AES-GCM |

## Próximos passos

- [ ] Modelos `CertA1`, `SerieFiscal`, `Webhook`, `ApiToken`
- [ ] Cofre cert A1 (envelope KMS) — depende de [04-armazenamento-s3.md](04-armazenamento-s3.md) extension
- [ ] Endpoints + UI por aba
- [ ] Geração de DANFE custom (logo + cor) — Fase 4
- [ ] Plano + cobrança (Stripe) — Fase 4
- [ ] Onboarding wizard (preenche empresa + carrega cert + cria 1ª série)
