# syntax=docker/dockerfile:1.7
# Dockerfile do apps/api (NestJS) para Render/Fly/qualquer runtime Docker.
# Build context = raiz do monorepo (precisa do pnpm-workspace e packages/*).

FROM node:22-alpine AS base
RUN apk add --no-cache bash openssl ca-certificates
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ---- deps ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
COPY tsconfig.base.json turbo.json ./
COPY packages/shared packages/shared
COPY packages/ui packages/ui
COPY apps/api apps/api
RUN pnpm --filter @nexo/shared build \
 && pnpm --filter @nexo/api build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/packages/ui ./packages/ui
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/package.json ./apps/api/
COPY apps/api/scripts ./apps/api/scripts
RUN chmod +x apps/api/scripts/release.sh

WORKDIR /repo/apps/api
EXPOSE 3333
CMD ["sh", "scripts/release.sh"]
