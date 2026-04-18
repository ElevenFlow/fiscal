# Postgres local (dev)

## Subir
```bash
docker compose up -d postgres
```

## Subir com pgAdmin (opcional)
```bash
docker compose --profile tools up -d
# pgAdmin: http://localhost:5050 (admin@nexofiscal.local / admin)
```

## Resetar (wipe + recreate)
```bash
# Bash / Git Bash
bash scripts/db-reset.sh

# PowerShell
./scripts/db-reset.ps1
```

## Roles criadas
- **app_admin** — BYPASSRLS, CREATEDB. Use para `prisma migrate` e admin de plataforma. Senha: `${APP_ADMIN_PASSWORD}`
- **app_user** — NOBYPASSRLS. Use para conexões do runtime da API. Senha: `${APP_USER_PASSWORD}`

## Extensões habilitadas
- `uuid-ossp` — geração de UUIDs
- `pgcrypto` — SHA-256 para idempotency keys e integridade

## Logs
```bash
docker compose logs -f postgres
```
