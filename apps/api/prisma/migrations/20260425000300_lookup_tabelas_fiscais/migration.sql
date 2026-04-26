-- Nexo Fiscal — Plan 02-01 — Lookup tables (catálogo global, sem RLS)
-- As CREATE TABLE de ncm/cest/cfop/lc116 estão na migration 20260425000100
-- (porque o `prisma migrate dev --create-only` agrupa todo o DDL gerado).
-- Esta migration adiciona GRANTs e índices full-text (trgm) que prisma diff
-- não emite.
--
-- REFS:
-- - threat_model T-02-01-05 (lookup expostas a tenants — accept; catálogo público)

-- ============================================================================
-- Grants — app_user só lê (catálogo curado pelo backoffice/worker mensal);
-- app_admin pode INSERT/UPDATE para sincronização via Plan 02-08 (worker)
-- ============================================================================
GRANT SELECT ON ncm   TO app_user;
GRANT SELECT ON cest  TO app_user;
GRANT SELECT ON cfop  TO app_user;
GRANT SELECT ON lc116 TO app_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON ncm   TO app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON cest  TO app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON cfop  TO app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON lc116 TO app_admin;

-- ============================================================================
-- Garantias adicionais para cache global (cnpj_cache/cep_cache):
-- migration 100 já fez GRANT para app_user; aqui apenas reafirmamos para
-- documentação e idempotência (não falha se grant já existe).
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON cnpj_cache TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON cep_cache  TO app_user;

-- ============================================================================
-- Full text search nas descrições — habilita autocomplete em UI/API
-- (`pg_trgm` GIN gives substring + typo-tolerant search via trigram similarity)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX ncm_descricao_trgm   ON ncm   USING gin (descricao gin_trgm_ops);
CREATE INDEX cest_descricao_trgm  ON cest  USING gin (descricao gin_trgm_ops);
CREATE INDEX cfop_descricao_trgm  ON cfop  USING gin (descricao gin_trgm_ops);
CREATE INDEX lc116_descricao_trgm ON lc116 USING gin (descricao gin_trgm_ops);
