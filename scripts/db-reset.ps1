# Reseta o Postgres local (PowerShell Windows).
# Uso: ./scripts/db-reset.ps1

$ErrorActionPreference = "Stop"

Write-Host "[db-reset] Parando containers..."
docker compose down

Write-Host "[db-reset] Removendo volume nexofiscal_postgres_data..."
try {
    docker volume rm nexofiscal_postgres_data 2>$null
} catch {
    Write-Host "[db-reset] Volume não existia."
}

Write-Host "[db-reset] Subindo Postgres fresco..."
docker compose up -d postgres

Write-Host "[db-reset] Aguardando healthcheck..."
$maxAttempts = 30
for ($i = 1; $i -le $maxAttempts; $i++) {
    $ready = docker compose exec -T postgres pg_isready -U postgres -d postgres 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[db-reset] Postgres pronto!"
        break
    }
    Start-Sleep -Seconds 1
}

Write-Host "[db-reset] Validando roles..."
docker compose exec -T postgres psql -U postgres -d nexofiscal_dev -c "\du"

Write-Host "[db-reset] Validando extensões..."
docker compose exec -T postgres psql -U postgres -d nexofiscal_dev -c "SELECT extname FROM pg_extension;"

Write-Host "[db-reset] Concluído."
