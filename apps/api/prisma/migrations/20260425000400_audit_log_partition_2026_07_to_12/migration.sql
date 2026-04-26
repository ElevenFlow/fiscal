-- Nexo Fiscal — Plan 02-01 — Estende particionamento mensal de audit_log até 2026-12.
-- Phase 1 migration 20260417000000 criou apenas 2026-04, 2026-05, 2026-06.
-- Esta migration adiciona 2026-07 até 2026-12 para evitar INSERT failure quando
-- a Phase 2 começar a popular eventos em meses futuros.
--
-- Em produção, Lambda + EventBridge cuidará disso (vide docs/OPS_README.md seção 3.1).
-- Em dev, rodamos esta migration manual para liberar o trabalho da Phase 2.
--
-- REFS:
-- - PITFALLS.md #7 (retenção fiscal — partições mensais, retention 5+ anos)
-- - threat_model T-02-01-08 (Plan 02-01)

SELECT ensure_audit_log_partition('2026-07-01'::date);
SELECT ensure_audit_log_partition('2026-08-01'::date);
SELECT ensure_audit_log_partition('2026-09-01'::date);
SELECT ensure_audit_log_partition('2026-10-01'::date);
SELECT ensure_audit_log_partition('2026-11-01'::date);
SELECT ensure_audit_log_partition('2026-12-01'::date);
