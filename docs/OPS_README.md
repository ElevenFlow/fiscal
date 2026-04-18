# Nexo Fiscal — Runbook de Operações (OPS_README)

**Público:** DevOps, SRE, DPO, responsável técnico da contabilidade-cliente, engenheiro de plantão.
**Escopo:** ponto único para **setup de produção**, **manutenção periódica**, **procedimentos de incidente** e **regras de CI/CD**.
**Última atualização:** 2026-04-18 (Plan 01-08 — FOUND-11).

> Toda comunicação neste documento é em pt-BR. Referências legais citam artigos de CTN, LGPD e Ajustes SINIEF — sempre validar com o DPO antes de aplicar procedimento em produção que envolva dados pessoais.

---

## 1. Setup Inicial de Produção

### 1.1 Pré-requisitos

- Conta AWS com acesso IAM admin temporário (MFA obrigatório) para criar CMK + buckets.
- Conta Clerk criada com app "Nexo Fiscal — Prod" (ver `docs/CLERK_SETUP.md` quando Plan 01-07 entregar este arquivo).
- Conta Sentry criada com projeto "nexofiscal-api" + "nexofiscal-web" (ver `docs/OBSERVABILITY.md` quando Plan 01-10 entregar este arquivo).
- Domínio apontando para ALB (ex: `app.nexofiscal.com.br`).

### 1.2 Provisionamento AWS

Os comandos abaixo estão detalhados em `infra/README.md` (Plan 01-02). Aqui listamos **a ordem obrigatória**:

1. **KMS CMK por ambiente** — `alias/nexofiscal-prod`, `alias/nexofiscal-staging`. Habilitar rotação anual. Documentar key ARN em Secrets Manager.
2. **S3 bucket fiscal** com **Object Lock Compliance Mode + 6 anos default retention** (irreversível — só criar quando aprovado). FOUND-11.
3. **S3 bucket de certificados** com Object Lock Governance Mode + 2 anos (permite rotação administrativa em caso de vazamento). Pitfall #18.
4. **Versionamento + BlockPublicAccess + SSE-KMS** em ambos os buckets.
5. **RDS Postgres 16 Multi-AZ** com `DATABASE_URL` (role `app_user`) e `DATABASE_ADMIN_URL` (role `app_admin` com `BYPASSRLS`). Plan 01-02.
6. **ElastiCache Redis 7** (cluster-mode-off no MVP) — usado por BullMQ Phase 3+.

### 1.3 Envs críticas (ORDEM IMPORTA — bootstrap valida com Zod)

| Var | Exemplo prod | Observação |
|-----|--------------|------------|
| `DATABASE_URL` | `postgresql://app_user:***@rds-prod:5432/nexofiscal_prod?sslmode=require` | Role runtime **sem** `BYPASSRLS` |
| `DATABASE_ADMIN_URL` | `postgresql://app_admin:***@rds-prod:5432/nexofiscal_prod?sslmode=require` | Role **com** `BYPASSRLS` — usado SÓ em migrations + cron de partições |
| `CLERK_SECRET_KEY` | `sk_live_...` | Rotação trimestral. Nunca commitar. |
| `CLERK_WEBHOOK_SECRET` | `whsec_...` | Valida assinatura Svix do webhook `user.created`/`organization.updated` |
| `STRICT_OBJECT_LOCK` | `true` | **Obrigatório `true` em prod** — aborta bootstrap se bucket fiscal não tem COMPLIANCE 6 anos (FOUND-11) |
| `AWS_KMS_KEY_ID` | `alias/nexofiscal-prod` | Usado por SSE-KMS em S3 uploads |
| `S3_BUCKET_FISCAL` | `nexofiscal-fiscal-prod` | Object Lock COMPLIANCE 6 anos |
| `S3_BUCKET_CERTS` | `nexofiscal-certs-prod` | Object Lock GOVERNANCE 2 anos |
| `SENTRY_DSN` | `https://...@sentry.io/...` | Projeto nexofiscal-api (Plan 01-10) |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://...` | Projeto nexofiscal-web (Plan 01-10) |
| `ALLOW_HEADER_AUTH` | `false` | **NUNCA `true` em prod/staging** (WARNING #10 Plan 01-05 — bypass de RLS via headers). Valor `true` é bloqueado pelo TenantContextMiddleware quando `NODE_ENV ∈ {production, staging}`. |
| `NODE_ENV` | `production` | Ativa ObjectLockVerifier + desativa headers de dev |
| `APP_URL` | `https://app.nexofiscal.com.br` | Usado para CORS + redirect Clerk |
| `API_URL` | `https://api.nexofiscal.com.br` | Usado pelo front para chamar `/api/*` |

Todas as senhas/keys ficam em **AWS Secrets Manager**. O ECS/Lambda/EC2 carrega via IAM role — nunca inline.

---

## 2. Healthchecks

### 2.1 API

```bash
curl -s https://api.nexofiscal.com.br/api/health | jq
```

Resposta esperada:

```json
{
  "status": "ok",
  "db": "ok",
  "uptime": 3421,
  "timestamp": "2026-04-18T12:34:56.789Z"
}
```

- `status = "degraded"` → DB indisponível → abrir **incidente HIGH** (ver seção 4.5) e validar RDS Multi-AZ failover.
- `status = "ok"` mas latência > 500ms → investigar Postgres `pg_stat_activity` por locks longos.

### 2.2 Web

```bash
curl -I https://app.nexofiscal.com.br
```

- `HTTP 200` ou `307` (redirect para /entrar se não autenticado) = OK.
- `5xx` prolongado → validar ECS task health + Vercel/ALB status.

### 2.3 Status público SEFAZ (dependência externa crítica)

- https://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx (NF-e)
- Consultar webservice de cada UF que a plataforma suporta.

---

## 3. Manutenção Periódica

### 3.1 Partições de `audit_log` (CRÍTICO — mensalmente, dia 25)

A migration Plan 01-04 cria `audit_log` como tabela particionada por `RANGE (occurred_at)` com partição mensal. A função `ensure_audit_log_partition(target_date DATE)` cria a partição do mês alvo se ainda não existe. **Sem isso, inserts no mês seguinte falham com `no partition of relation ... found`.**

**Procedimento manual:**

```sql
-- Conectado com DATABASE_ADMIN_URL (app_admin tem BYPASSRLS)
SELECT ensure_audit_log_partition(CURRENT_DATE + INTERVAL '1 month');
SELECT ensure_audit_log_partition(CURRENT_DATE + INTERVAL '2 month'); -- margem de 1 mês
```

**Automação (recomendado — fazer antes de abrir produção real):**

Lambda + EventBridge rule `cron(0 8 25 * ? *)` (08:00 UTC dia 25 de cada mês) que executa:

```bash
PGPASSWORD="$APP_ADMIN_PASSWORD" psql \
  -h "$RDS_HOST" -U app_admin -d nexofiscal_prod \
  -c "SELECT ensure_audit_log_partition(CURRENT_DATE + INTERVAL '1 month');"
```

Usar credenciais de Secrets Manager; Lambda em VPC com SG de acesso ao RDS. Alertar no Slack/Sentry se retornar NOTICE que indica criação ou se a chamada falhar.

### 3.2 Arquivamento de partições antigas — role `app_archiver` time-boxed

Partições > **2 anos** podem ser arquivadas para S3 Glacier (custo de storage 80% menor) **sem violar** a retenção legal (CTN: 5 anos; mantemos 7 no Glacier por segurança).

**Por que role separado?** Plan 01-04 **WARNING #7** removeu um `REVOKE UPDATE, DELETE` em `app_admin` que bloqueava archival sem adicionar defesa real — o trigger BEFORE UPDATE/DELETE já bloqueia **todos** os roles (exceto `BYPASSRLS`/superuser). A criação de role dedicado e **time-boxed** documenta a intenção operacional e limita blast radius caso a credencial vaze.

**1) Criar role time-boxed (operador humano, janela de manutenção):**

```sql
-- Gerar senha aleatória forte; salvar temporariamente em Secrets Manager
CREATE ROLE app_archiver LOGIN PASSWORD '<generated-32-chars>'
  NOBYPASSRLS
  VALID UNTIL 'now() + interval ''4 hours''';

GRANT UPDATE, DELETE ON audit_log TO app_archiver;
-- O trigger ainda bloqueia; esta GRANT só libera operações de DDL
-- (DETACH PARTITION / DROP TABLE em partições já desanexadas).
GRANT pg_read_server_files TO app_archiver;
```

**2) Executar archival (preferencialmente job, não manual):**

```sql
-- 2.1 Copiar dados para S3 via aws_s3 extension ou export + aws s3 cp
\copy audit_log_2024_04 TO '/tmp/audit_log_2024_04.csv' CSV HEADER;

-- 2.2 Desanexar partição (não é DELETE; não dispara trigger)
ALTER TABLE audit_log DETACH PARTITION audit_log_2024_04;

-- 2.3 Após upload confirmado, dropar a partição desanexada
DROP TABLE audit_log_2024_04;
```

```bash
# 2.4 Upload efetivo para S3 Glacier Deep Archive
aws s3 cp /tmp/audit_log_2024_04.csv \
  s3://nexofiscal-archive-prod/audit_log/audit_log_2024_04.csv \
  --storage-class DEEP_ARCHIVE \
  --sse aws:kms --sse-kms-key-id alias/nexofiscal-prod
```

**3) Revogar role imediatamente após:**

```sql
-- Mesmo com VALID UNTIL, revogar explicitamente fecha a janela
REVOKE ALL ON audit_log FROM app_archiver;
DROP ROLE app_archiver;
```

**4) Registrar no audit trail operacional** (issue interna com:
- Partição arquivada + hash SHA-256 do CSV
- Janela temporal dos eventos
- Quem executou + ticket autorizador
- Confirmação de upload Glacier (ETag)

### 3.3 Rotação KMS

A rotação automática anual já está configurada em `infra/README.md` via `aws kms enable-key-rotation`. Operador deve validar trimestralmente no console que a rotação continua ativa.

### 3.4 Backup RDS pré-migrations

Antes de cada `pnpm db:migrate` em produção:

```bash
aws rds create-db-snapshot \
  --db-instance-identifier nexofiscal-prod \
  --db-snapshot-identifier "nexofiscal-prod-pre-migration-$(date +%Y%m%d%H%M)"
```

Aguardar status `available` antes de aplicar migration. Em rollback, fazer `restore-db-instance-from-db-snapshot` para instance nova + cutover de DNS.

### 3.5 Rotação de certificados A1 (contínuo por tenant)

Ver Pitfall #10 (PITFALLS.md). Fase 2 entrega o job `certificado-expiring-alert` com escalonamento D-60 / D-30 / D-15 / D-7 / D-0. Operador monitora **Dashboard da contabilidade > Certificados** e contata empresas com cert em D-7.

---

## 4. Incidentes

Cada incidente tem **severidade**, **SLA de contenção**, **procedimento ordenado** e **obrigações de notificação**.

### 4.1 CRITICAL — Vazamento cross-tenant (PITFALLS #1)

**Severidade:** CRITICAL — notificação ANPD obrigatória em **72h** (LGPD Art. 48).
**SLA de contenção:** 15 minutos para isolar.

1. **Isolar**: desabilitar feature flag da funcionalidade suspeita OU bloquear o tenant atacante via `UPDATE tenants SET status='suspended'`.
2. **Identificar escopo**: consultar `pg_stat_statements` + `audit_log` filtrando pela janela temporal e pelas tabelas afetadas. Listar todos tenants que leram dados de outros.
3. **Notificar tenants afetados** por e-mail registrado + ligação telefônica para os principais.
4. **Notificar ANPD em até 72h** via https://www.gov.br/anpd/pt-br/canais_atendimento/comunicado-de-incidente-de-seguranca — DPO (`dpo@nexofiscal.com.br`) lidera a comunicação.
5. **Post-mortem público** no blog/changelog com timeline + correção + medidas preventivas.
6. **Auditoria externa** independente (contratar DFIR) para validar contenção e identificar se houve exfiltração além do escopo identificado.

### 4.2 CRITICAL — Certificado A1 vazado

**Severidade:** CRITICAL — risco de fraude fiscal (terceiro emite nota no CNPJ alheio).
**SLA de contenção:** 30 minutos para revogação.

1. **Revogar certificado na AC** (Serasa, Certisign, Valid etc — depende do emissor).
2. **Notificar empresa** por telefone (não apenas e-mail) + DPO da contabilidade responsável.
3. **Auditar emissões dos últimos 30 dias** com esse certificado (`SELECT * FROM nota_fiscal WHERE certificado_fingerprint = ?`).
4. **Forçar upload de novo cert** no portal (bloqueio de emissão até novo upload).
5. **Considerar notificação ANPD** se houve exposição de CPF/CNPJ + dados dos destinatários.
6. Avaliar responsabilização civil do operador/vetor do vazamento.

### 4.3 HIGH — Object Lock desabilitado / inválido em produção

**Severidade:** HIGH — descumprimento regulatório (CTN Art. 173/174, FOUND-11).
**SLA de contenção:** bloqueio de bootstrap imediato se `STRICT_OBJECT_LOCK=true`.

**Comportamento automatizado:** `ObjectLockVerifier` valida no bootstrap:
- `ObjectLockEnabled = "Enabled"`
- `DefaultRetention.Mode = "COMPLIANCE"`
- `DefaultRetention.Years >= 6`

Com `STRICT_OBJECT_LOCK=true` em prod, qualquer violação aborta o boot (`[ObjectLockVerifier FATAL]`). Em staging/dev, emite `Logger.warn` e prossegue.

**Remediação:** Object Lock só é ativável **na CRIAÇÃO do bucket** (irreversível). Se descoberto que o bucket ativo não tem Object Lock:

1. Congelar uploads (feature flag bloqueia Phase 3+ de emitir — fila retém).
2. Criar bucket novo com configuração correta (ver `infra/README.md` seção 5.3).
3. `aws s3 sync` de todos os objetos do bucket antigo para o novo (ordem: primeiro certs, depois XMLs ordenados por emissão).
4. Atualizar `S3_BUCKET_FISCAL` env + redeploy.
5. Manter bucket antigo read-only por 30 dias para rollback.
6. Dropar bucket antigo após auditoria confirmar paridade.

### 4.4 HIGH — SEFAZ indisponível

**Severidade:** HIGH — bloqueia emissão mas não bloqueia consulta.
**SLA de contenção:** circuit breaker abre em ≤ 30s após 5 falhas consecutivas.

**Comportamento automatizado (Phase 3):**
- Circuit breaker **Opossum** por UF abre após threshold.
- Banner no app exibe status + link para https://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx.
- Novas emissões entram em fila BullMQ com retry exponencial.
- Consultas de notas já autorizadas continuam (read do banco local).

**Ação operador:** comunicar empresas por in-app + changelog; acompanhar status oficial; retomar automaticamente quando circuit fechar.

### 4.5 HIGH — Audit failure burst

**Severidade:** HIGH — pode indicar DB degradado OU bug em trigger BEFORE UPDATE/DELETE.
**SLA de contenção:** alerta quando rate `audit_failure > 5/min` por 5 minutos.

**Indicador:** WARNING #8 do Plan 01-05 loga `audit_failure` via `Logger.error` quando `audit.record()` rejeita em `setImmediate`. Sentry agrega; Grafana alerta se rate sobe.

**Procedimento:**
1. Validar saúde do Postgres (`GET /api/health` + `pg_stat_activity`).
2. Verificar se trigger imutabilidade está ativa: `SELECT tgname FROM pg_trigger WHERE tgrelid = 'audit_log'::regclass`.
3. Se trigger OK e DB OK, investigar payload dos eventos que falham — pode ser violação de NOT NULL em campos obrigatórios (ver Plan 01-05 AuditService).
4. Se DB degradado, failover RDS Multi-AZ.

### 4.6 MEDIUM — Rejeição 539 em massa

Ver Pitfall #3. Pausar série afetada, consultar status por chave, inutilizar números perdidos, retomar.

### 4.7 MEDIUM — Importação XML duplicada

Ver Pitfall #13. Identificar por `chave_acesso`, reverter movimentação de estoque.

---

## 5. Regras de CI/CD

Todo PR para `main` deve passar (CI bloqueia merge em falha):

| Check | Comando | Gate |
|-------|---------|------|
| Build | `pnpm --filter @nexo/api build` | Exit 0 |
| Typecheck | `pnpm -r typecheck` | Exit 0 |
| Lint (Biome) | `pnpm -r lint` | Exit 0 |
| Unit tests | `pnpm -r test` | All pass |
| **RLS regression suite** | `pnpm --filter @nexo/api test:rls` | 13/13 pass (Plan 01-04) |
| **RolesGuard e2e** | `pnpm --filter @nexo/api test roles-guard.e2e-spec.ts` | Pass (BLOCKER #1 regression) |
| **safeLog + audit-interceptor** | `pnpm --filter @nexo/api test safe-log.spec.ts audit-interceptor.spec.ts` | Pass (WARNINGs #6 e #8) |
| **Lint logger calls** | `grep -RIn --include='*.ts' 'logger\.\(info\|warn\|error\)({' apps/api/src | grep -v 'safeLog('` | Zero matches (PITFALLS #11) |
| **Security audit** | `pnpm audit` | Zero CVEs critical/high |
| **Docker build** | `pnpm install --frozen-lockfile` | Lockfile íntegro |

**Migrations em prod:**

1. Snapshot RDS pré-migration (seção 3.4).
2. Aplicar com `DATABASE_ADMIN_URL` (role com `BYPASSRLS`): `pnpm db:migrate`.
3. Suite smoke: `curl /api/health` → `status=ok`.
4. Rollback: restaurar snapshot + redeploy imagem anterior.

---

## 6. Contatos

| Função | Canal |
|--------|-------|
| **DPO (LGPD)** | dpo@nexofiscal.com.br |
| **Security Incident** | security@nexofiscal.com.br |
| **On-call engineer** | Pager (PagerDuty rotation) |
| **AWS Support** | https://console.aws.amazon.com/support/ (plan Business em prod) |
| **Clerk Support** | https://clerk.com/support |
| **Sentry Support** | https://sentry.io/support/ |
| **Focus NFe Support** | https://focusnfe.com.br/contato (Phase 3+) |

---

## 7. Referências

### Documentação interna

- **`infra/README.md`** — comandos AWS CLI para provisionar S3 Object Lock + KMS (Plan 01-02).
- **`docs/CLERK_SETUP.md`** — passo-a-passo Clerk Organizations (Plan 01-07 entregará).
- **`docs/OBSERVABILITY.md`** — setup Sentry + OpenTelemetry (Plan 01-10 entregará).
- **`.planning/research/PITFALLS.md`** — catálogo de 23 armadilhas do domínio fiscal BR.
- **`.planning/research/ARCHITECTURE.md`** — topologia alvo + trust boundaries.

### Legislação

- **CTN Art. 173, 174, 195, 198** — prazo decadencial fiscal (5 anos) + sigilo fiscal. Base legal para retenção obrigatória 6 anos em S3 Object Lock Compliance.
- **LGPD (Lei 13.709/2018) Arts. 7 (bases legais), 16 (retenção por obrigação legal), 18 (direitos do titular), 48 (notificação de incidente em prazo razoável — ANPD orienta 72h para casos de risco relevante).**
- **Ajuste SINIEF 07/2005** + **NT NF-e 2023.004+** — regras de emissão de NF-e + CC-e + layout 4.00.
- **Lei Complementar 116/2003** — ISS e serviços.

### Fontes externas (operação)

- https://www.gov.br/anpd/ — canal oficial de comunicação de incidente LGPD
- https://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx — status público SEFAZ
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-overview.html — Object Lock semantics

---

*Este runbook é vivo — atualizar a cada incidente real (seção 4 ganha o caso), a cada rotação de credenciais crítica e a cada alteração de stack fiscal. Versionar via git; nunca imprimir credenciais; compartilhar via repositório privado apenas.*
