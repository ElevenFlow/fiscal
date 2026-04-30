# Phase 8 — Validação Operacional Pós-MVP

**Status:** concluída localmente em 2026-04-30
**Tipo:** validação operacional/documental pós-roadmap

## Objetivo

Executar uma checagem operacional depois da Fase 7 para confirmar que o MVP técnico continua buildável, tipado e com testes fiscais críticos passando, além de separar o que pode ser validado localmente do que depende de ambiente real.

## Validações Executadas

| Checagem | Resultado | Observação |
|---|---|---|
| `pnpm.cmd --filter @nexo/shared typecheck` | Passou | Warning local de engine Node 20 vs alvo Node 22 |
| `pnpm.cmd --filter @nexo/api typecheck` | Passou | Warning local de engine Node 20 vs alvo Node 22 |
| `pnpm.cmd --filter @nexo/web typecheck` | Passou | Warning local de engine Node 20 vs alvo Node 22 |
| `pnpm.cmd --filter @nexo/api build` | Passou | Prisma Client gerado e Nest build concluído |
| `pnpm.cmd --filter @nexo/web build` | Passou | Rotas do MVP presentes no build de produção |
| `pnpm.cmd --filter @nexo/api test -- fiscal-gateway.spec.ts fiscal-xml-signature.spec.ts` | Passou | 2 arquivos, 6 testes fiscais |
| Revisão de `vercel.json` | Passou localmente | Build configurado para `@nexo/web` |

## Evidências Técnicas

- Build web listou rotas de autenticação, cadastros, certificados, séries, emissão NF-e/NFS-e/devolução, importação XML, estoque, documentos, alertas, dashboards, configurações, usuários e auditoria.
- Testes fiscais mantiveram cobertura mínima da porta `FiscalGateway` e assinatura XMLDSig.
- O deploy Vercel está configurado na raiz com:
  - `buildCommand`: `pnpm turbo run build --filter=@nexo/web`
  - `installCommand`: `pnpm install --frozen-lockfile`

## Limites Da Validação

- O ambiente local usa Node v20.17.0; o projeto exige Node >=22. Isso não quebrou a validação local, mas o runtime de produção deve usar Node 22.
- O build web mantém warning conhecido de OpenTelemetry/Sentry sobre dependência dinâmica.
- Não foi possível validar o estado real do deploy na Vercel sem acesso ao dashboard/CLI autenticado.
- Não foi possível validar variáveis reais de produção, migrations no banco alvo, buckets S3 Object Lock, KMS, certificado A1 ou homologação SEFAZ-SC/SVRS sem credenciais e infraestrutura real.

## Pendência Criada

Foi registrada a `PEND-026` em `.planning/PENDENCIAS.md`:

> Definir se o próximo passo será um piloto controlado ou atacar pendências críticas primeiro.

Essa decisão deve acontecer antes de iniciar o próximo ciclo, porque altera diretamente a ordem de execução: ou o produto entra em piloto com escopo e risco controlados, ou primeiro atacamos as pendências P0/P1 que ainda dependem de ambiente real.
