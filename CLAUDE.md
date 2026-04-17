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
## Technology Stack

## TL;DR Executivo
### Callout Crítico — Assinatura XMLDSig A1 (ponto #1 de falha em projetos fiscais BR)
## Build vs Buy — A Decisão-Raiz
### Opções avaliadas
| Opção | Custo aprox. | Time-to-market | Controle | Dependência | Recomendação |
|-------|-------------|----------------|---------|------------|--------------|
| **A. Gateway BaaS (Focus NFe / PlugNotas / Nuvem Fiscal)** | R$ 0,08–R$ 0,50 por documento + mensalidade; NFS-e por prefeitura não listada: R$ 199 flat integração | 1–3 meses | Médio (API própria deles) | Alta (vendor) | **ESCOLHIDO para MVP** |
| B. Biblioteca Node.js própria (NFeWizard-io + xml-crypto) | CAPEX engenharia ~6–12 meses sênior | 6–12 meses | Alto | Baixa | Diferir para Fase 2+ |
| C. Biblioteca PHP (sped-nfe) atrás de microserviço | CAPEX médio + polyglot | 3–6 meses | Alto | Baixa | **Rejeitado** — adiciona runtime PHP sem ganho sobre NFeWizard-io |
| D. .NET (ACBr, Zeus, Uni) | CAPEX + hosting Windows | 4–8 meses | Alto | Baixa | **Rejeitado** — ecossistema fiscal é forte, mas quebra pipeline JS/TS unificado |
### Rationale da escolha (Opção A)
## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **TypeScript** | 5.6+ | Linguagem primária backend + frontend | Stack unificado; melhor ecossistema SaaS em 2026; forte checagem estática para código fiscal (valores monetários, códigos CFOP) |
| **Node.js** | 22 LTS | Runtime backend | LTS até 2027; performance adequada para SOAP + I/O; suporta `node --run` e `node:sqlite` nativos |
| **Next.js** | 15.x (App Router) | Frontend fullstack + SSR | Padrão SaaS B2B 2026; Server Components reduzem JS no cliente; React Server Actions simplificam formulários fiscais; ecossistema maior de libs SaaS ([decisão Next vs SvelteKit 2026](https://dev.to/pockit_tools/nextjs-vs-remix-vs-astro-vs-sveltekit-in-2026-the-definitive-framework-decision-guide-lp5)) |
| **NestJS** | 11.x | Backend API | Arquitetura opinionada (modules, guards, interceptors) casa com requisitos de multi-tenant + audit + RBAC — cada preocupação vira interceptor/guard testável. Alternativa: **Fastify puro** se time preferir menor sobrecarga (ver decisão abaixo) |
| **PostgreSQL** | 16+ | Banco primário | RLS (Row-Level Security) nativa é **a tecnologia-chave** para isolamento multi-tenant rígido ([padrão de mercado 2026](https://www.thenile.dev/blog/multi-tenant-rls)); JSONB para payloads XML parsed; `pg_partman` para particionar `audit_log` e `nota_fiscal` por `tenant_id + ano` |
| **Prisma ORM** | 6.x | ORM + migrations | Suporte maduro a RLS via `$extends` + `set_config('app.tenant_id', ...)`; DX superior; schema-first; alternativa Drizzle é mais leve mas integração RLS exige mais plumbing manual |
| **Redis** | 7.x | Cache + filas (BullMQ) + rate limit | Exigido por BullMQ; cache de tabelas NCM/CFOP/CEST; session store se não usar JWT |
### Fiscal-Specific (Build-vs-Buy Decision)
| Technology | Purpose | Recommendation | Confidence |
|------------|---------|----------------|------------|
| **[Focus NFe API](https://focusnfe.com.br/doc/)** | Gateway primário NFe/NFS-e/Cancelamento | **ESCOLHIDO** — 1.400+ prefeituras, R$ 199 flat para novas, docs públicos, trial 30d | HIGH |
| **[PlugNotas](https://plugnotas.com.br/)** | Gateway secundário / contingência | Manter provisão — 1.600+ cidades | MEDIUM |
| **[Nuvem Fiscal](https://www.nuvemfiscal.com.br/)** | Alternativa futura | Suporte agora via Projeto ACBr (08/02/2026); acompanhar | MEDIUM |
| **[NFeWizard-io](https://github.com/nfewizard-org/nfewizard-io)** | Biblioteca interna (Fase 2+) | **Quando internalizar NFe** — tem tratamento C14N; requer JDK (Java Runtime) no servidor | MEDIUM |
| **[brasil-js/danfe](https://github.com/brasil-js/danfe)** | DANFE PDF (NF-e) a partir de XML autorizado | Usar para evitar depender de PDF do gateway; controla layout e branding | MEDIUM |
| **Puppeteer** (`puppeteer-core` + `@sparticuz/chromium` em serverless) | DANFSE PDF (NFS-e) — layout varia por prefeitura | Render HTML→PDF com template React; estratégia padrão para NFS-e | HIGH |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Zod** | 3.23+ | Schema validation | Todos os boundaries: API DTOs, XML parsed, formulários. Evita "string com formato de CNPJ" virar bug silencioso |
| **fast-xml-parser** | 4.5+ | Parse de XML de compra (importação) | Mais rápido que `xml2js`, zero-dep, suporta `preserveOrder` (importante para auditoria fiel do XML recebido) |
| **xmlbuilder2** | 3.1+ | Geração de XML (se/quando internalizar) | Usado por NFeWizard-io; produção de XML canônico |
| **xml-crypto** | 6.x | Assinatura XMLDSig (**só internamente**) | **ATENÇÃO:** configurar explicitamente `canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'` e `signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'` para NFe 4.00. Testar contra XML-testes do Manual. |
| **node-forge** | 1.3+ | Extração de chave privada do .pfx | Parse PKCS#12, extrai `privateKey` e `certificate` para assinatura; também usado para gerar fingerprint do certificado |
| **soap** ou **strong-soap** | 1.x | Cliente SOAP SEFAZ (**só internamente**) | Quando internalizar: `soap` da team oficial suporta mTLS (`wsdl_options.cert`, `key`, `ca`); configurar `forceSoap12Headers: false` para SEFAZ (SOAP 1.1/1.2 varia por UF) |
| **BullMQ** | 5.x | Filas de jobs + retries exponenciais | Emissão assíncrona, contingência SEFAZ (retry com backoff), geração de DANFE em background, envio de e-mail; **padrão Node.js 2026** ([docs](https://docs.bullmq.io)) |
| **Inngest** | latest | Alternativa se preferir durable execution | Para quem não quer gerenciar Redis; caro em volume fiscal, mas dev-experience superior para fluxos NFe "emitir → autorizar → retry → notificar" |
| **Pino** | 9.x | Logger estruturado | JSON por default; `redact` para mascarar `cpfCnpj` e `pfxBuffer`; integra com Sentry + Datadog via transports |
| **@aws-sdk/client-kms** | 3.x | Criptografia envelope de .pfx | Chave KMS por tenant (ou master key + data key); cifra buffer do .pfx antes de gravar em S3 |
| **@aws-sdk/client-s3** | 3.x | Armazenamento de XMLs + DANFEs + .pfx cifrado | Bucket com **Object Lock (WORM)** para XMLs autorizados (compliance 5 anos) e `Versioning` + `Lifecycle` para custos |
| **Resend** ou **AWS SES** | — | Envio de e-mail (convites + nota ao destinatário) | Resend: DX superior, $20/mês 50k emails; SES: mais barato em volume, `sa-east-1` regional (LGPD) |
### UI / Frontend
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **[shadcn/ui](https://ui.shadcn.com)** | latest (copy-paste) | Design system base | Ownership total do código, fácil atingir o visual "premium clean" do briefing; casa com Tailwind; padrão de mercado SaaS 2026 |
| **Radix UI** | primitives 1.x | A11y primitives sob shadcn | Keyboard nav, focus trap, screen reader — necessário para SaaS B2B sério |
| **Tailwind CSS** | 4.x | Styling utility-first | Paleta customizada (`#1E5FD8` azul, `#1BA97A` verde, `#E54848` danger) via `@theme`; Inter + JetBrains Mono via `font-*` tokens |
| **TanStack Table** | 8.x | Tabelas densas (Documentos, Produtos, Logs) | Pagination/sort/filter server-side, column resize, row selection — padrão 2026 para tabelas SaaS |
| **TanStack Query** | 5.x | Data fetching + cache cliente | Invalidation granular, optimistic updates para emitir/cancelar |
| **React Hook Form** + **Zod resolver** | 7.x | Formulários fiscais grandes (CRUD empresa, emissão) | Performance em forms com 50+ campos; mesmos schemas Zod do backend (single source of truth) |
| **cmdk** | latest | Ctrl+K palette | Exigido pelo briefing (busca global) |
| **Recharts** | 2.x | Gráficos dashboards | Suficiente para KPIs; alternativa Tremor se quiser "dashboard kit" completo |
| **date-fns** + `date-fns-tz` | 4.x | Datas pt-BR + timezone BRT | Formatação BR e cálculos de prazos legais (24h cancelamento NF-e, 720h CC-e) |
| **zod-form-data** | latest | Parse de FormData com Zod em Server Actions | Integra Next.js App Router + validação forte |
### Auth & Multi-Tenant
| Option | Recommendation | Rationale |
|--------|----------------|-----------|
| **[Clerk](https://clerk.com)** com Organizations | **ESCOLHIDO para MVP** | Organizations já modela Contabilidade→Empresa; convites por e-mail nativos; RBAC via roles+permissions; DX excelente com Next.js App Router; $0.02/MAU após 10k free |
| [WorkOS AuthKit](https://workos.com) | Upgrade se enterprise | Quando surgir demanda B2B enterprise (SSO/SAML para contabilidade grande) — pode coexistir |
| [Supabase Auth](https://supabase.com/auth) | Rejeitado | UI moveu para community maintenance em 02/2024; organization management é DIY |
| Auth.js / NextAuth | Rejeitado | Sem organization/tenant primitives — reimplementar hierarquia 3 níveis é trabalho significativo |
- Mapear **Clerk Organization** ⇄ **tabela `contabilidade`**
- Empresa = subentidade dentro da organização contábil (tabela `empresa` com FK `contabilidade_id`)
- Sessão carrega `{ user_id, contabilidade_id, empresas_visiveis[], role }`
- Middleware seta `SET LOCAL app.tenant_id = contabilidade_id` em cada request (RLS)
- Admin plataforma usa role `BYPASSRLS` separado
### Infrastructure / Hosting
| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Região cloud** | **AWS sa-east-1 (São Paulo)** | Latência SEFAZ SP/SE 2–8ms vs 120–160ms us-east-1; reduz timeout em webservice SOAP; conforto LGPD (dados em território nacional) ([referência latência](https://aws.amazon.com/pt/local/saopaulo/)) |
| **App hosting (Next.js)** | **AWS ECS Fargate** atrás de ALB, ou **Vercel** se preferir zero-ops | Vercel `sao1` (São Paulo) existe para hobby/pro mas custos escalonam; Fargate dá controle e previsibilidade |
| **DB** | **AWS RDS Postgres 16** (Multi-AZ) | Backups automáticos, Point-in-Time, KMS at-rest; alternativa **Neon** (branching + serverless) para economia no início |
| **Redis** | **AWS ElastiCache** (cluster mode off no MVP) | Exigido pelo BullMQ |
| **Object Storage** | **S3 sa-east-1 com Object Lock (compliance mode)** | XML autorizado + DANFE PDF com retenção 5 anos imutável; `.pfx` cifrado em bucket separado com policy restrita |
| **CDN** | **CloudFront** (global OK) | Estáticos do Next.js; WAF básico |
| **Secrets** | **AWS Secrets Manager** + **KMS CMK por tenant** | Credenciais do gateway fiscal, DATABASE_URL, chaves de sessão; CMK por tenant isola blast radius do vazamento de `.pfx` |
| **CI/CD** | **GitHub Actions** + **AWS CodeDeploy** | Padrão; custo zero até volume relevante |
### Observability
| Tool | Role | Tier |
|------|------|------|
| **Sentry** | Error tracking + release tracking + session replay (cuidado com LGPD) | Essencial desde dia 1; $26/mês Team, scaling por eventos |
| **OpenTelemetry SDK** + **Grafana Cloud** (ou **SigNoz self-hosted**) | Traces + metrics + logs unificados | Instrumentação vendor-neutral; SigNoz economiza custo em volume |
| **BetterStack** ou **UptimeRobot** | Uptime + status page pública | Pública para contadores verem status SEFAZ + plataforma |
| **AWS CloudWatch Logs** | Logs brutos + retention policy | Base da estrutura; Pino → CloudWatch transport |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| **pnpm** | Package manager + workspaces | Monorepo `apps/web` + `apps/api` + `packages/shared` + `packages/fiscal-gateway` |
| **Turborepo** | Build orchestration | Cache de testes/build; remote cache via Vercel ou S3 |
| **Biome** ou **ESLint + Prettier** | Lint + format | Biome é 10x mais rápido em 2026; Prettier+ESLint se time já tem muscle memory |
| **Vitest** | Unit tests | Substituto natural do Jest; melhor DX com ESM |
| **Playwright** | E2E fiscal flows (emitir NFe homologação, importar XML, cancelar) | **Crítico** — contract tests contra ambiente de homologação do gateway |
| **Tsx** ou **Bun** | Runner de scripts TS (seeds, migrations) | `tsx` se ficar 100% Node.js |
| **dotenvx** ou **doppler** | Gerenciamento de env locais | Criptografia de `.env` commitados (substitui `dotenv-vault`) |
## Installation (scaffolding reference)
# Monorepo
# apps/web (Next.js + shadcn + Clerk)
# apps/api (NestJS + Prisma + BullMQ)
# packages/fiscal-gateway (porta + adapter Focus NFe)
# packages/xml-tools (parser XML compra + DANFE)
# Quando internalizar emissão (Fase 2+):
# Dev
## Alternatives Considered
| Recommended | Alternative | When Alternative Wins |
|-------------|-------------|----------------------|
| Next.js 15 | **Remix/React Router 7** | Se time tem aversão a Server Components e quer web standards puros; equivalente em capacidade |
| Next.js 15 | **SvelteKit** | Se bundle size é crítico e time topa aprender Svelte 5 Runes — bundle 60% menor |
| NestJS | **Fastify puro + módulos caseiros** | Se time prefere estilo Go/Express minimalista; ganha performance, perde estrutura enterprise |
| NestJS | **Hono** | Se deploy em edge (Cloudflare Workers) — **não aplicável aqui**: emissão fiscal precisa de long-running process e Node APIs |
| Prisma | **Drizzle ORM** | Se query builder SQL-first é preferido; Drizzle é mais leve mas integração com RLS exige mais plumbing manual |
| Postgres + RLS | **Schema-per-tenant** | Apenas para enterprise onde tenant individualmente tem >1M linhas/tabela; complexidade de migration 10x maior |
| Clerk | **Better Auth** self-hosted | Economia direta; trade-off: construir organizations + RBAC + MFA UI |
| Focus NFe | **PlugNotas / Nuvem Fiscal** | Se preço for fator decisivo; rodar POC com 3 provedores em homologação antes de decidir |
| AWS sa-east-1 | **Magalu Cloud / locaweb cloud** | Se diferencial de marketing "100% nacional" for relevante; ferramental menor |
| BullMQ | **pg-boss** | Se **não queremos Redis no stack**; menos performático em alta contenção, mas simplifica ops |
| shadcn/ui | **Mantine** | Se velocidade de entrega importa mais que design distintivo; tabelas complexas prontas em minutos |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Assinar XML "manualmente" com `xml-crypto` sem C14N explícito** | Rejeição SEFAZ 297 ("Signature differs from calculated") é virtualmente certa; whitespace/namespace quebra ([referência](https://flexdocs.net/guiaNFe/FAQ.assinatura.html)) | Focus NFe (gateway) no MVP; NFeWizard-io depois |
| **Certificado A1 em variável de ambiente ou sistema de arquivos em claro** | Vazamento = alguém emite notas no CNPJ do cliente (**risco criminal**) | `.pfx` cifrado com KMS envelope encryption, policy IAM restrita, audit log em toda leitura |
| **Logar `pfxPassword` ou `pfxBuffer`** | LGPD + risco de fraude | Pino `redact: ['pfxPassword', 'pfxBuffer', 'password', 'req.headers.authorization']` |
| **`xml2js` para XML grandes de compra** | Lento e memory-hungry; não preserva ordem (problema para auditoria do XML recebido) | `fast-xml-parser` com `preserveOrder: true` |
| **Guardar DANFE gerado como fonte de verdade** | DANFE é **representação visual**; fonte é o XML autorizado | Re-gerar DANFE sob demanda a partir do XML; armazenar XML com Object Lock |
| **Timezone UTC nos campos fiscais** | SEFAZ exige `dhEmi` em `-03:00` (BRT); cancelamento em 24h é contado em horário local | `America/Sao_Paulo` explícito em emissão; UTC apenas para timestamps internos |
| **SQLite ou MySQL para multi-tenant com RLS** | SQLite não tem RLS; MySQL RLS é primitivo (só views) | Postgres 16+ |
| **`nfe-io` SDK oficial** como dependência única | Plataforma proprietária com preços por tier; lock-in alto; API menos flexível que Focus | Focus NFe como primário |
| **Pastas de certificados em instâncias EC2** | Perde ao autoscalar; difícil rotacionar | S3 cifrado + cache local efêmero em memória por worker (TTL 30 min) |
| **`xml-crypto@<4`** | Vulnerabilidades conhecidas de signature wrapping | `xml-crypto@6.x` |
| **`moment.js`** | Deprecated desde 2020 | `date-fns` + `date-fns-tz` |
| **Assinar NFe em serverless com cold start ~2s** | Emissão com timeout SEFAZ; cold start + C14N + SOAP call pode estourar | ECS Fargate sempre-quente ou EC2; serverless OK para APIs de leitura |
| **`serverless-framework` v2** | EOL | SST v3 ou CDK se for IaC |
| **Supabase Auth UI** para produção | Migrou para community maintenance (02/2024) | Clerk / WorkOS |
| **Datadog** no MVP | Bill imprevisível; $31/host + $0.10/span indexado escala rápido | Sentry + Grafana Cloud / SigNoz |
## Multi-Tenant Data Isolation — Padrão Prescritivo
- **Índice composto obrigatório:** `CREATE INDEX ON nota_fiscal (tenant_id, created_at DESC)` — sem isso, RLS vira full-scan
- **Particionar** `audit_log` e `nota_fiscal` por `tenant_id` + ano via `pg_partman` (retenção 5 anos)
- **Contract tests** no CI: "user da contabilidade A não pode ver linha da contabilidade B" — rodar em cada PR
## Audit Log — Padrão Append-Only / WORM
- Tabela `audit_log` com `REVOKE UPDATE, DELETE FROM app_user` (só INSERT permitido)
- Trigger `BEFORE UPDATE/DELETE` que faz `RAISE EXCEPTION`
- Snapshot diário para **S3 Object Lock Compliance Mode** (imutável mesmo para root AWS) com retenção 5 anos — exigência fiscal
- Campos mínimos: `id (uuid)`, `tenant_id`, `user_id`, `action`, `resource_type`, `resource_id`, `diff (jsonb)`, `ip`, `user_agent`, `created_at (tz)`
- Hash chain opcional (`prev_hash + row_hash`) para detecção de tampering pós-escrita (exigência em contextos financeiros/fiscais rigorosos)
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@15` | `react@19`, `react-dom@19` | Next 15 requer React 19; shadcn componentes compatíveis |
| `prisma@6` | Postgres 14+, Node 18+ | Suporte RLS via `$extends` estável desde 5.x |
| `@nestjs/core@11` | `rxjs@7.8+`, Node 18+ | Com Fastify adapter: `@nestjs/platform-fastify@11` |
| `bullmq@5` | Redis 6.2+, Node 18+ | Usa streams; não compatível com Redis < 5 |
| `xml-crypto@6` | Node 16+ | Versões 4+ fecharam CVEs de signature wrapping |
| `nfewizard-io@latest` | **Java JDK 11+ instalado** | Dependência Java para alguns fluxos — impacta escolha do runtime/container |
| `@clerk/nextjs@latest` | `next@14+` App Router | Middleware precisa estar em `middleware.ts` na raiz |
| `tailwindcss@4` | PostCSS 8+ | Nova engine; shadcn tem guia de migração específico |
## Stack Patterns by Variant
- Vai com NestJS + Next.js conforme acima — máxima alavancagem do stack unificado, schemas Zod compartilhados via `packages/shared`
- Considere manter camada fiscal em .NET (Zeus NFe, ACBrLib) como microserviço separado, expor gRPC/HTTP para o monólito TS. Só compensa se já há experiência consolidada — senão polyglot custa mais do que economiza.
- **Next.js fullstack sem NestJS separado**; use Server Actions + Route Handlers; Clerk + Prisma + BullMQ; deploy em Vercel `sao1` + Neon + Upstash Redis. Migrar para AWS/NestJS no pós-MVP.
- Adicionar microserviço `fiscal-worker` em Node.js + NFeWizard-io com container incluindo `eclipse-temurin:17-jre` (JDK) + caching agressivo de WSDLs. Isolado do monólito principal.
## Sources
### Fiscal & Brazilian ecosystem
- [Portal Nacional da NF-e — Fazenda](https://www.nfe.fazenda.gov.br/) — fonte oficial (HIGH)
- [Orientações NFS-e 2026 — Prefeitura de SP](https://prefeitura.sp.gov.br/web/fazenda/w/nfs-e_orientacoes) — padrão SP mantido (HIGH)
- [NFS-e Nacional obrigatoriedade — Ministério da Fazenda](https://www.gov.br/fazenda/pt-br/assuntos/noticias/2025/agosto/a-partir-de-janeiro-de-2026-a-nota-fiscal-de-servico-eletronica-nfs-e-sera-obrigatoria-a-fim-de-simplificar-cotidiano-das-empresas) (HIGH)
- [Focus NFe — docs API](https://focusnfe.com.br/doc/) + [planos](https://focusnfe.com.br/precos/) (HIGH)
- [PlugNotas](https://plugnotas.com.br/nfse/) — 1.600+ cidades (MEDIUM)
- [Nuvem Fiscal](https://www.nuvemfiscal.com.br/) + [API docs](https://dev.nuvemfiscal.com.br/docs/api/) (MEDIUM)
- [NFeWizard-io — GitHub](https://github.com/nfewizard-org/nfewizard-io) + [docs](https://nfewizard-org.github.io/) (MEDIUM)
- [sped-nfe (PHP)](https://github.com/nfephp-org/sped-nfe) — referência de arquitetura (HIGH para padrão, não escolhido)
- [node-sped-nfe](https://github.com/kalmonv/node-sped-nfe) e [node-dfe](https://github.com/lealhugui/node-dfe) — alternativas (LOW — manutenção incerta)
- [brasil-js/danfe](https://github.com/brasil-js/danfe) — DANFE PDF (MEDIUM)
- [FAQ Assinatura NFe — FlexDocs](https://flexdocs.net/guiaNFe/FAQ.assinatura.html) — pitfalls C14N (MEDIUM)
- [Erros comuns NFe — TecnoSpeed](https://blog.tecnospeed.com.br/como-resolver-falha-no-schema-xml-da-nf-e-nfc-e/) (MEDIUM)
### Stack & framework
- [Next.js vs Remix vs SvelteKit 2026 — DEV](https://dev.to/pockit_tools/nextjs-vs-remix-vs-astro-vs-sveltekit-in-2026-the-definitive-framework-decision-guide-lp5) (MEDIUM)
- [Encore — TS backend frameworks 2026](https://encore.dev/articles/best-typescript-backend-frameworks) (MEDIUM)
- [shadcn vs Mantine 2026 — SaaSIndie](https://saasindie.com/blog/mantine-vs-shadcn-ui-comparison) (MEDIUM)
- [Multi-tenant RLS com Postgres — Nile](https://www.thenile.dev/blog/multi-tenant-rls) (HIGH para padrão)
- [Multi-tenant RLS com Prisma — Medium](https://medium.com/@francolabuschagne90/securing-multi-tenant-applications-using-row-level-security-in-postgresql-with-prisma-orm-4237f4d4bd35) (MEDIUM)
- [Clerk Organizations vs WorkOS — comparativo](https://clerk.com/blog/multi-tenant-vs-single-tenant) (MEDIUM)
- [BullMQ — docs oficiais](https://docs.bullmq.io) (HIGH)
- [AWS sa-east-1 — São Paulo Region](https://aws.amazon.com/pt/local/saopaulo/) (HIGH)
### Crypto & XML
- [xml-crypto — GitHub node-saml](https://github.com/node-saml/xml-crypto) (HIGH)
- [node-forge — npm](https://www.npmjs.com/package/node-forge) (HIGH)
- [Node.js docs — pfx/pkcs12 in https module](https://docs.hidglobal.com/auth-service/docs/buildingapps/nodejs/read-different-certificate-key-file-formats-with-node-js.htm) (MEDIUM)
- [AWS KMS — criptografia envelope](https://docs.aws.amazon.com/pt_br/kms/latest/cryptographic-details/intro.html) (HIGH)
- [SEC08-BP02 Well-Architected — criptografia em repouso](https://docs.aws.amazon.com/pt_br/wellarchitected/latest/security-pillar/sec_protect_data_rest_encrypt.html) (HIGH)
### Observability
- [Datadog vs Sentry 2026](https://betterstack.com/community/comparisons/datadog-vs-sentry/) (MEDIUM)
- [Sentry alternativas 2026](https://securityboulevard.com/2026/04/best-sentry-alternatives-for-error-tracking-and-monitoring-2026/) (MEDIUM)
## Open Questions (para validar em POC)
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

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
