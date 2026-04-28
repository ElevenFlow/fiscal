-- Nexo Fiscal - Phase 3.1 - Fundacao NF-e 55 direta SEFAZ-SC
-- Dominio fiscal inicial: notas_fiscais + nota_fiscal_eventos.

CREATE TABLE "notas_fiscais" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "serie_fiscal_id" UUID,
    "modelo" VARCHAR(10) NOT NULL,
    "ambiente" TEXT NOT NULL,
    "serie" INTEGER NOT NULL,
    "numero" BIGINT,
    "chave_acesso" VARCHAR(44),
    "status" TEXT NOT NULL,
    "idempotency_key" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "xml_assinado_s3_key" TEXT,
    "xml_autorizado_s3_key" TEXT,
    "recibo" TEXT,
    "protocolo_autorizacao" TEXT,
    "rejeicao_codigo" VARCHAR(10),
    "rejeicao_mensagem" TEXT,
    "cancelamento_protocolo" TEXT,
    "cancelada_em" TIMESTAMPTZ(6),
    "emitida_em" TIMESTAMPTZ(6),
    "autorizada_em" TIMESTAMPTZ(6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_fiscais_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notas_fiscais_modelo_check" CHECK ("modelo" IN ('NFE_55')),
    CONSTRAINT "notas_fiscais_ambiente_check" CHECK ("ambiente" IN ('HOMOLOGACAO', 'PRODUCAO')),
    CONSTRAINT "notas_fiscais_status_check" CHECK ("status" IN ('DRAFT', 'SIGNING', 'TRANSMITTING', 'PENDING_RESPONSE', 'AUTHORIZED', 'REJECTED', 'CANCELLED'))
);

CREATE TABLE "nota_fiscal_eventos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nota_fiscal_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "codigo" VARCHAR(20),
    "mensagem" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nota_fiscal_eventos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notas_fiscais_tenant_id_idempotency_key_key" ON "notas_fiscais"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "notas_fiscais_tenant_id_chave_acesso_key" ON "notas_fiscais"("tenant_id", "chave_acesso");
CREATE UNIQUE INDEX "notas_fiscais_tenant_id_modelo_serie_numero_key" ON "notas_fiscais"("tenant_id", "modelo", "serie", "numero");
CREATE INDEX "notas_fiscais_tenant_id_created_at_idx" ON "notas_fiscais"("tenant_id", "created_at" DESC);
CREATE INDEX "notas_fiscais_tenant_id_status_created_at_idx" ON "notas_fiscais"("tenant_id", "status", "created_at" DESC);
CREATE INDEX "nota_fiscal_eventos_tenant_id_created_at_idx" ON "nota_fiscal_eventos"("tenant_id", "created_at" DESC);
CREATE INDEX "nota_fiscal_eventos_nota_fiscal_id_created_at_idx" ON "nota_fiscal_eventos"("nota_fiscal_id", "created_at" DESC);

ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "empresas"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_serie_fiscal_id_fkey" FOREIGN KEY ("serie_fiscal_id") REFERENCES "series_fiscais"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "nota_fiscal_eventos" ADD CONSTRAINT "nota_fiscal_eventos_nota_fiscal_id_fkey" FOREIGN KEY ("nota_fiscal_id") REFERENCES "notas_fiscais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON notas_fiscais TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON nota_fiscal_eventos TO app_user;

ALTER TABLE notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_fiscais FORCE ROW LEVEL SECURITY;

CREATE POLICY notas_fiscais_tenant_isolation ON notas_fiscais
  FOR ALL TO app_user
  USING (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE nota_fiscal_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE nota_fiscal_eventos FORCE ROW LEVEL SECURITY;

CREATE POLICY nota_fiscal_eventos_tenant_isolation ON nota_fiscal_eventos
  FOR ALL TO app_user
  USING (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );
