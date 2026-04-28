/**
 * QUEUE_NAMES — registro central de filas BullMQ usadas no apps/api.
 *
 * Plan 02-05 introduz `cert-expiration` (cron diário 03:00 BRT que varre
 * certificados ativos e gera alertas D-60..D-0). Planos futuros adicionam
 * filas para emissão de NF-e (Phase 3), importação de XML (Phase 5),
 * worker NCM/CEST/CFOP/LC116 (02-08) etc.
 *
 * Padrão: nomes em kebab-case sem prefix de fase — a fila é o contrato,
 * a fase é só o momento da introdução.
 */
export const QUEUE_NAMES = {
  CERT_EXPIRATION: 'cert-expiration',
  FISCAL_EMISSION: 'fiscal-emission',
  LOOKUP_SYNC: 'lookup-sync',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Job IDs idempotentes — usados em `queue.upsertJobScheduler` /
 * `queue.add(name, data, { jobId })` para garantir que reagendamentos
 * (ex: app restart) não duplicam scheduler.
 */
export const SCHEDULER_JOB_IDS = {
  CERT_EXPIRATION_DAILY: 'cert-expiration-daily',
  LOOKUP_SYNC_MONTHLY: 'lookup-sync-monthly',
} as const;
