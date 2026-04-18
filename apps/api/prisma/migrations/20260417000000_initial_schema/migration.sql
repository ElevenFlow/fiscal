-- Nexo Fiscal — Initial schema (Plan 01-04)
-- Multi-tenant base: users, contabilidades, empresas, contabilidade_empresas,
-- user_memberships, audit_log (PARTITIONED BY RANGE (created_at)).
-- RLS policies são aplicadas em migration seguinte (20260417000100_rls_policies).
-- Trigger de imutabilidade do audit_log em 20260417000200_audit_log_trigger.
--
-- REFS:
-- - ARCHITECTURE.md (Multi-Tenancy Strategy)
-- - PITFALLS.md #1 (vazamento cross-tenant) — RLS é defesa final
-- - REQUIREMENTS.md: FOUND-05, FOUND-06, FOUND-07, FOUND-09

-- ============================================================================
-- Extensions (idempotente — init.sql já cria, mas garantimos aqui também)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- users — identidade global
-- ============================================================================
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" TEXT NOT NULL,
    "clerk_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users"("clerk_user_id");

-- ============================================================================
-- contabilidades — entidade ator (não é tenant, mas acessa N tenants)
-- ============================================================================
CREATE TABLE "contabilidades" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "clerk_org_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contabilidades_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contabilidades_cnpj_key" ON "contabilidades"("cnpj");
CREATE UNIQUE INDEX "contabilidades_clerk_org_id_key" ON "contabilidades"("clerk_org_id");

-- ============================================================================
-- empresas — tenant_id == id (empresa É o tenant)
-- ============================================================================
CREATE TABLE "empresas" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "razao_social" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "regime_tributario" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "empresas_tenant_id_key" ON "empresas"("tenant_id");
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");
CREATE INDEX "empresas_tenant_id_created_at_idx" ON "empresas"("tenant_id", "created_at" DESC);

-- Trigger: tenant_id = id sempre. Empresa É o tenant.
CREATE OR REPLACE FUNCTION empresa_set_tenant_id() RETURNS TRIGGER AS $$
BEGIN
  NEW.tenant_id := NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER empresa_tenant_id_before_insert
BEFORE INSERT ON empresas
FOR EACH ROW EXECUTE FUNCTION empresa_set_tenant_id();

-- ============================================================================
-- contabilidade_empresas — junction (FOUND-06)
-- ============================================================================
CREATE TABLE "contabilidade_empresas" (
    "contabilidade_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contabilidade_empresas_pkey" PRIMARY KEY ("contabilidade_id", "empresa_id"),
    CONSTRAINT "contabilidade_empresas_contabilidade_id_fkey" FOREIGN KEY ("contabilidade_id") REFERENCES "contabilidades"("id") ON DELETE CASCADE,
    CONSTRAINT "contabilidade_empresas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE
);
CREATE INDEX "contabilidade_empresas_empresa_id_idx" ON "contabilidade_empresas"("empresa_id");

-- ============================================================================
-- user_memberships — RBAC hierárquico
-- ============================================================================
CREATE TABLE "user_memberships" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_id" UUID,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_memberships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "user_memberships_scope_check" CHECK (scope_type IN ('platform', 'contabilidade', 'empresa')),
    CONSTRAINT "user_memberships_role_check" CHECK (role IN ('admin', 'contabilidade_owner', 'contabilidade_operador', 'empresa_owner', 'empresa_operador', 'empresa_leitura'))
);
CREATE INDEX "user_memberships_user_id_idx" ON "user_memberships"("user_id");
CREATE INDEX "user_memberships_scope_type_scope_id_idx" ON "user_memberships"("scope_type", "scope_id");

-- ============================================================================
-- audit_log — PARTITIONED por created_at (mensal); imutável via trigger (migration 200)
-- FOUND-09: auditoria imutável com retenção de 5+ anos (CTN Art. 174)
-- ============================================================================
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "diff" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "result" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id", "created_at"),
    CONSTRAINT "audit_log_result_check" CHECK (result IN ('success', 'failure'))
) PARTITION BY RANGE ("created_at");

CREATE INDEX "audit_log_tenant_id_created_at_idx" ON "audit_log"("tenant_id", "created_at" DESC);
CREATE INDEX "audit_log_user_id_created_at_idx" ON "audit_log"("user_id", "created_at" DESC);

-- ============================================================================
-- Partições iniciais (mês corrente + 2 próximos).
-- Em produção, job cron cria partição do próximo mês antecipadamente.
-- ============================================================================
CREATE TABLE "audit_log_2026_04" PARTITION OF "audit_log"
  FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-05-01 00:00:00+00');
CREATE TABLE "audit_log_2026_05" PARTITION OF "audit_log"
  FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');
CREATE TABLE "audit_log_2026_06" PARTITION OF "audit_log"
  FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

-- ============================================================================
-- Função helper — criar partição sob demanda (cron mensal)
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_audit_log_partition(target_date DATE)
RETURNS VOID AS $$
DECLARE
  partition_name TEXT;
  start_date TEXT;
  end_date TEXT;
BEGIN
  partition_name := 'audit_log_' || TO_CHAR(target_date, 'YYYY_MM');
  start_date := TO_CHAR(DATE_TRUNC('month', target_date), 'YYYY-MM-DD 00:00:00+00');
  end_date := TO_CHAR(DATE_TRUNC('month', target_date) + INTERVAL '1 month', 'YYYY-MM-DD 00:00:00+00');

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF audit_log FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION ensure_audit_log_partition(DATE) IS
  'Cria partição mensal de audit_log para a data alvo se não existir. Chamar em job cron mensal.';
