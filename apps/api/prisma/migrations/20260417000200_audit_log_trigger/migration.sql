-- Nexo Fiscal — audit_log imutabilidade (Plan 01-04)
-- Trigger BEFORE UPDATE/DELETE → RAISE EXCEPTION.
-- FOUND-09: toda ação crítica gera registro que NÃO pode ser editado/deletado.
-- PITFALLS.md #7 (retenção fiscal) — combina com S3 Object Lock (Plan futuro) para defesa em camadas.
-- PITFALLS.md #11 (logs com PII) — diff JSON deve ser redigido ANTES de inserir; schema aqui só garante estrutura.

-- ============================================================================
-- Função trigger: rejeita qualquer UPDATE/DELETE em audit_log
-- ============================================================================
CREATE OR REPLACE FUNCTION audit_log_reject_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is immutable: % is not allowed', TG_OP
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Triggers em audit_log — Postgres 13+ propaga para partições filhas.
-- ============================================================================
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_reject_mutation();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_reject_mutation();

-- ============================================================================
-- Defesa adicional (cinto-e-suspensórios): revogar UPDATE/DELETE de app_user.
-- NOTA: app_admin mantém para workflows de archival futuro (role app_archiver
-- com GRANT time-boxed documentado em docs/OPS_README.md quando Phase 7 hardening).
-- Trigger já bloqueia TODOS os roles — este REVOKE é a segunda camada.
-- ============================================================================
REVOKE UPDATE, DELETE ON audit_log FROM app_user;

-- ============================================================================
-- Documentação embutida no catálogo
-- ============================================================================
COMMENT ON TABLE audit_log IS
  'Immutable append-only log. UPDATE/DELETE rejected by trigger. Partitioned by created_at (monthly). Retention: 5+ years (CTN Art. 174). See FOUND-09.';

COMMENT ON FUNCTION audit_log_reject_mutation() IS
  'Rejects any UPDATE/DELETE on audit_log to enforce immutability. FOUND-09 + PITFALLS.md #7.';
