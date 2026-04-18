-- Nexo Fiscal — RLS Policies (Plan 01-04)
-- Row-Level Security para isolamento multi-tenant.
-- Padrão: current_setting('app.current_tenant') setado via SET LOCAL em cada transação.
-- Admin bypass: current_setting('app.role') = 'platform_admin'.
--
-- REFS:
-- - ARCHITECTURE.md seção "Multi-Tenancy Strategy"
-- - PITFALLS.md #1 — RLS é defesa final contra vazamento (CVE-2024-10976 / CVE-2025-8713)
-- - REQUIREMENTS.md: FOUND-05 (isolamento), FOUND-06 (contabilidade carteira), FOUND-07 (admin bypass)

-- ============================================================================
-- empresas — policy principal multi-tenant (FOUND-05 + FOUND-06 + FOUND-07)
-- ============================================================================
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas FORCE ROW LEVEL SECURITY;

CREATE POLICY empresa_tenant_isolation ON empresas
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    OR current_setting('app.role', true) = 'platform_admin'
    OR id IN (
      SELECT empresa_id FROM contabilidade_empresas
      WHERE contabilidade_id = NULLIF(current_setting('app.current_contabilidade', true), '')::uuid
        AND ativo = true
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    OR current_setting('app.role', true) = 'platform_admin'
  );

-- ============================================================================
-- contabilidade_empresas — contabilidade vê sua carteira (FOUND-06)
-- ============================================================================
ALTER TABLE contabilidade_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidade_empresas FORCE ROW LEVEL SECURITY;

CREATE POLICY contabilidade_empresas_isolation ON contabilidade_empresas
  USING (
    contabilidade_id = NULLIF(current_setting('app.current_contabilidade', true), '')::uuid
    OR empresa_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    OR current_setting('app.role', true) = 'platform_admin'
  )
  WITH CHECK (
    current_setting('app.role', true) = 'platform_admin'
    OR contabilidade_id = NULLIF(current_setting('app.current_contabilidade', true), '')::uuid
  );

-- ============================================================================
-- user_memberships — user vê apenas suas próprias memberships; admin vê todas
--
-- NOTA DE NOMENCLATURA: usamos `app.current_user_id` (não `app.current_user`)
-- porque `current_user` é palavra-chave reservada do Postgres — `SET LOCAL
-- app.current_user = ...` gera syntax error no parser. Todos os GUCs seguem
-- o mesmo padrão em with-tenant.ts.
-- ============================================================================
ALTER TABLE user_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY user_memberships_isolation ON user_memberships
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR current_setting('app.role', true) = 'platform_admin'
  )
  WITH CHECK (
    current_setting('app.role', true) = 'platform_admin'
  );

-- ============================================================================
-- audit_log — tenant vê seus eventos; admin vê tudo; INSERT livre (append)
-- Imutabilidade (UPDATE/DELETE bloqueados) é aplicada em migration 200 via trigger.
-- ============================================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_log_read ON audit_log
  FOR SELECT
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    OR current_setting('app.role', true) = 'platform_admin'
  );

CREATE POLICY audit_log_insert ON audit_log
  FOR INSERT
  WITH CHECK (true);  -- Qualquer sessão autenticada pode inserir; imutabilidade aplicada por trigger.

-- ============================================================================
-- Permissões explícitas a app_user (NOBYPASSRLS) — RLS filtra linhas, GRANT permite ação.
-- init.sql já concede (default privileges), mas repetimos para tabelas já existentes.
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
