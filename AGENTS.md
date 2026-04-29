<!-- GSD:project-start source:PROJECT.md -->
## Project

**Nexo Fiscal**

Nexo Fiscal é uma plataforma SaaS multiempresa brasileira que conecta contabilidades e seus clientes em um único ambiente, centralizando emissão de notas fiscais (NFS-e, NF-e, nota de devolução), cadastros, importação automática de XML de compra, controle simplificado de estoque, consulta de documentos fiscais, alertas operacionais e trilha de auditoria. Foco em simplicidade, clareza visual e produtividade para micro, pequenas e médias empresas e para escritórios contábeis que atendem essa base.

**Core Value:** Emitir qualquer nota fiscal (NFS-e, NF-e ou devolução) em menos de um minuto, com a contabilidade responsável enxergando tudo em tempo real e sem fricção operacional para o empresário final.

### Constraints

- **Jurisdição**: Brasil — todas as funcionalidades fiscais devem respeitar legislação brasileira (RFB, SEFAZs estaduais, prefeituras municipais).
- **Idioma**: Português-BR em todas as interfaces, documentos e comunicações.
- **Moeda**: BRL, formato pt-BR (vírgula decimal, ponto como separador de milhar).
- **Segurança de certificado**: A1 (.pfx) deve ser criptografado em repouso com chave derivada de secret do tenant; jamais logado ou exposto em frontend.
- **Multi-tenancy**: isolamento rígido a nível de aplicação + banco (tenant_id em todas as queries) — vazamento cross-tenant é incidente crítico.
- **Auditoria**: logs imutáveis com retenção mínima de 5 anos (alinhado com prazo decadencial fiscal).
- **Performance**: emissão de nota com retorno ≤ 10s em 95% dos casos (dependência externa SEFAZ); upload/leitura de XML ≤ 5s por arquivo; dashboard ≤ 2s.
- **Responsividade**: desktop-first para formulários fiscais críticos; mobile prioriza consulta/alertas.
- **Compatibilidade de navegador**: Chrome, Edge, Firefox — últimas 2 versões. Safari desejável.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Stack (resumo)

Detalhes completos, alternativas e rationale: [.planning/research/STACK.md](.planning/research/STACK.md). Runbook de ops e LGPD: [docs/OPS_README.md](docs/OPS_README.md). Observabilidade: [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md).

- **Runtime/Linguagem:** Node 22 LTS + TypeScript 5.6 strict
- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind 3 + shadcn/ui + cmdk + Recharts + React Hook Form + Zod
- **Backend:** NestJS 11 (Fastify adapter) + Pino + Zod + Prisma 6
- **Banco:** Postgres 16 com RLS forçado, roles `app_user` (NOBYPASSRLS) / `app_admin` (BYPASSRLS, só migrations)
- **Filas:** BullMQ + Redis 7 (planejado a partir da Phase 3)
- **Fiscal MVP:** gateway BaaS via porta `FiscalGateway` (Focus NFe primário, PlugNotas fallback). Internalização com NFeWizard-io diferida.
- **Auth:** in-house JWT HS256 + argon2id + sessions com refresh rotation (Phase 02.1; Plans 2-5 em Phase 7.1 para email/hardening/MFA)
- **Cloud:** AWS sa-east-1 (RDS Postgres + S3 Object Lock Compliance + KMS CMK por tenant + ElastiCache + Fargate ou Vercel `sao1`)
- **Observabilidade:** Sentry + OpenTelemetry (no-op sem env)
- **Tooling:** pnpm + Turborepo + Biome + Vitest + Playwright

### Regras prescritivas críticas (não delegáveis)

**Multi-tenant / RLS**
- Toda tabela de domínio carrega `tenant_id` + índice composto `(tenant_id, created_at DESC)` — sem isso RLS vira full-scan.
- Runtime usa `app_user` NOBYPASSRLS; `set_config('app.tenant_id', ..., true)` em cada request via `withTenantContext`.
- Particionar `audit_log` e `nota_fiscal` por `tenant_id + ano` (`pg_partman`), retenção 5 anos.
- Contract test no CI: usuário da contabilidade A não pode ver linha da contabilidade B.

**Audit log / WORM**
- `audit_log` é append-only: `REVOKE UPDATE, DELETE FROM app_user` + trigger `BEFORE UPDATE/DELETE` com `RAISE EXCEPTION`.
- Snapshot diário para S3 Object Lock **Compliance Mode** (imutável mesmo para root AWS), retenção 6 anos.
- Campos mínimos: `id, tenant_id, user_id, action, resource_type, resource_id, diff (jsonb), ip, user_agent, created_at (tz)`.

**Certificado A1 / segurança fiscal**
- `.pfx` **nunca** em env var, FS em claro ou log. Sempre KMS envelope encryption + S3 cifrado + audit em toda leitura.
- Pino `redact` obrigatório: `['pfxPassword', 'pfxBuffer', 'password', 'cpf', 'cnpj', 'authorization', 'xml', 'token']`.
- Assinatura XMLDSig só internamente quando internalizar — exige C14N explícito (`xml-c14n-20010315`) + `rsa-sha1` para NFe 4.00. No MVP: delegar ao gateway.

**Fiscal**
- DANFE/DANFSE são **representações visuais** — fonte de verdade é o XML autorizado. Re-gerar PDF sob demanda.
- Datas fiscais (`dhEmi`, prazos de cancelamento, CC-e) em `America/Sao_Paulo`, não UTC.
- Emissão NFe **não** roda em serverless cold-start (timeout SEFAZ). Worker sempre-quente (Fargate/EC2).

### Não usar (resumo)
`xml2js` para XMLs grandes (use `fast-xml-parser` com `preserveOrder`); `xml-crypto < 6`; `moment.js` (use `date-fns` + `date-fns-tz`); SQLite/MySQL para multi-tenant; pasta de `.pfx` em EC2 (use S3 + cache efêmero em memória, TTL 30min); Datadog no MVP; Supabase Auth UI em produção.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.Codex/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow

GSD é **opcional por padrão**. Use só quando o trabalho realmente justifica o overhead de planejamento e auditoria.

| Trabalho | Ferramenta |
|---|---|
| Tudo (fixes, docs, refactors, ajustes, bugs, scripts, mocks de UI) | Edição direta — sem GSD |
| **Nova rotina/funcionalidade do sistema com esforço significativo** (multi-arquivo, schema novo, integração externa, fluxo crítico) | `/gsd-plan-phase N` → `/gsd-execute-phase N` |
| Execução de fase já planejada do roadmap | `/gsd-execute-phase N` |

Regras:
- **Não exija GSD para tarefas pequenas.** Bug fix, ajuste de cópia, edição de doc, refactor isolado, script ad-hoc — vai direto.
- Para **novas rotinas grandes** (ex.: módulo de emissão NF-e, importação XML, módulo de estoque), passe pelo fluxo: `/gsd-plan-phase` → revisar PLAN.md → `/gsd-execute-phase`.
- Áreas críticas (**schema Prisma, RLS policies, audit_log, S3 Object Lock, KMS, certificado A1**) merecem plano mínimo se a mudança for estrutural; alterações pontuais nessas áreas (ajuste de campo, fix de bug) podem ir direto.
- Antes de criar PLAN.md novo, checar se já existe SUMMARY.md cobrindo o assunto em `.planning/phases/`.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-Codex-profile` -- do not edit manually.
<!-- GSD:profile-end -->
