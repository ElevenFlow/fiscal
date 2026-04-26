-- Nexo Fiscal — Plan 02-01 — RLS policies para tabelas Phase 2
-- Padrão: current_setting('app.role') = 'platform_admin' bypass +
--         tenant_id = NULLIF(current_setting('app.current_tenant'),'')::uuid
-- Mesma estratégia da migration 20260417000100_rls_policies.
--
-- REFS:
-- - PITFALLS.md #1 (vazamento cross-tenant)
-- - REQUIREMENTS.md: CAD-04 (isolamento por empresa)
-- - threat_model T-02-01-01 / T-02-01-02 (Plan 02-01)

-- ============================================================================
-- clientes
-- ============================================================================
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes FORCE ROW LEVEL SECURITY;

CREATE POLICY clientes_tenant_isolation ON clientes
  FOR ALL TO app_user
  USING (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

-- ============================================================================
-- fornecedores
-- ============================================================================
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores FORCE ROW LEVEL SECURITY;

CREATE POLICY fornecedores_tenant_isolation ON fornecedores
  FOR ALL TO app_user
  USING (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

-- ============================================================================
-- produtos
-- ============================================================================
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos FORCE ROW LEVEL SECURITY;

CREATE POLICY produtos_tenant_isolation ON produtos
  FOR ALL TO app_user
  USING (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

-- ============================================================================
-- servicos
-- ============================================================================
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos FORCE ROW LEVEL SECURITY;

CREATE POLICY servicos_tenant_isolation ON servicos
  FOR ALL TO app_user
  USING (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

-- ============================================================================
-- certificados_digitais
-- ============================================================================
ALTER TABLE certificados_digitais ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificados_digitais FORCE ROW LEVEL SECURITY;

CREATE POLICY certificados_digitais_tenant_isolation ON certificados_digitais
  FOR ALL TO app_user
  USING (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

-- ============================================================================
-- alertas_certificado
-- ============================================================================
ALTER TABLE alertas_certificado ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_certificado FORCE ROW LEVEL SECURITY;

CREATE POLICY alertas_certificado_tenant_isolation ON alertas_certificado
  FOR ALL TO app_user
  USING (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

-- ============================================================================
-- series_fiscais
-- ============================================================================
ALTER TABLE series_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_fiscais FORCE ROW LEVEL SECURITY;

CREATE POLICY series_fiscais_tenant_isolation ON series_fiscais
  FOR ALL TO app_user
  USING (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

-- ============================================================================
-- cnpj_cache + cep_cache: SEM RLS (cache global compartilhado — T-02-01-03)
-- Não contêm dados tenant-específicos; resposta de APIs públicas (BrasilAPI/ViaCEP).
-- ============================================================================
