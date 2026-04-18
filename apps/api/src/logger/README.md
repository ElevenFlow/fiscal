# Logger — Convenção

## Regra 1: sempre passe objetos por safeLog()

```ts
// ERRADO — cpf pode cair no log se redact falhar
logger.info({ userId, cpf, action: 'lookup' });

// CORRETO — safeLog filtra chaves não-whitelisted
import { safeLog } from './logger/safe-log';
logger.info(safeLog({ userId, cpf, action: 'lookup' }), 'lookup');
```

## Regra 2: adicionar chave ao whitelist exige code review + security sign-off

Toda nova entrada em `ALLOWED_LOG_KEYS` (em `safe-log.ts`) precisa de PR com aprovação
dedicada. Rationale documentado no commit.

## Regra 3: CI grep check

CI roda:

```bash
# Falha se encontrar logger.(info|warn|error)({ sem passar por safeLog
! grep -rn -E "logger\.(info|warn|error)\(\s*\{" apps/api/src/ --include="*.ts" \
  | grep -v "safeLog(" \
  | grep -v "safe-log.ts"
```

(Convertido para eslint rule custom no Plan 07+ se desejado.)

## Regra 4: defense-in-depth — Pino redact + safeLog

Mesmo com safeLog() aplicado em todo call-site, o Pino redact (`redact-paths.ts`) permanece
ativo como segunda camada. Se um dev esquecer de chamar safeLog(), o redact ainda
intercepta chaves sensíveis conhecidas (password, cpf, cnpj, pfx, authorization, ...).

Whitelist (safeLog) + blacklist (Pino redact) = dois independentes níveis de defesa.
