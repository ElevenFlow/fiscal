# Nexo Fiscal

SaaS fiscal brasileiro multi-tenant. Monorepo pnpm + Turborepo.

## Workspaces

- `apps/web` — Next.js 15 (frontend + BFF)
- `apps/api` — NestJS 11 (backend API + workers)
- `packages/shared` — Tipos e schemas Zod compartilhados

## Pré-requisitos

- Node 22 LTS (`.nvmrc`)
- pnpm 9.x (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)

## Setup

```bash
pnpm install
pnpm turbo build
```

## Scripts

- `pnpm dev` — desenvolvimento (todos workspaces)
- `pnpm build` — build de produção
- `pnpm lint` — Biome check
- `pnpm format` — Biome format --write
- `pnpm typecheck` — tsc --noEmit em todos workspaces
