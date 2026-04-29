-- Nexo Fiscal - Phase 5 - Importacao XML de compra + estoque.

CREATE TABLE "xml_importacoes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "chave_acesso" VARCHAR(44) NOT NULL,
    "arquivo_nome" TEXT NOT NULL,
    "fornecedor_nome" TEXT NOT NULL,
    "fornecedor_cnpj" VARCHAR(14),
    "emitida_em" TIMESTAMPTZ(6),
    "valor_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "itens" JSONB NOT NULL,
    "erro_mensagem" TEXT,
    "confirmed_at" TIMESTAMPTZ(6),
    "undone_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xml_importacoes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "xml_importacoes_status_check" CHECK ("status" IN ('PENDENTE_REVISAO', 'PROCESSADO', 'ERRO', 'DESFEITO'))
);

CREATE TABLE "movimentacoes_estoque" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "produto_id" UUID,
    "xml_importacao_id" UUID,
    "produto_codigo" TEXT NOT NULL,
    "produto_descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "origem_id" TEXT,
    "quantidade" DECIMAL(15,3) NOT NULL,
    "saldo_apos" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "motivo" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_estoque_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "movimentacoes_estoque_tipo_check" CHECK ("tipo" IN ('entrada', 'saida', 'ajuste', 'estorno')),
    CONSTRAINT "movimentacoes_estoque_origem_check" CHECK ("origem" IN ('xml', 'nfe', 'manual'))
);

CREATE UNIQUE INDEX "xml_importacoes_tenant_id_chave_acesso_key" ON "xml_importacoes"("tenant_id", "chave_acesso");
CREATE INDEX "xml_importacoes_tenant_id_status_created_at_idx" ON "xml_importacoes"("tenant_id", "status", "created_at" DESC);
CREATE INDEX "xml_importacoes_tenant_id_created_at_idx" ON "xml_importacoes"("tenant_id", "created_at" DESC);
CREATE INDEX "movimentacoes_estoque_tenant_id_created_at_idx" ON "movimentacoes_estoque"("tenant_id", "created_at" DESC);
CREATE INDEX "movimentacoes_estoque_tenant_id_produto_id_created_at_idx" ON "movimentacoes_estoque"("tenant_id", "produto_id", "created_at" DESC);
CREATE INDEX "movimentacoes_estoque_tenant_id_tipo_created_at_idx" ON "movimentacoes_estoque"("tenant_id", "tipo", "created_at" DESC);

ALTER TABLE "xml_importacoes" ADD CONSTRAINT "xml_importacoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "empresas"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "empresas"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_xml_importacao_id_fkey" FOREIGN KEY ("xml_importacao_id") REFERENCES "xml_importacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON xml_importacoes TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON movimentacoes_estoque TO app_user;

ALTER TABLE xml_importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE xml_importacoes FORCE ROW LEVEL SECURITY;

CREATE POLICY xml_importacoes_tenant_isolation ON xml_importacoes
  FOR ALL TO app_user
  USING (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes_estoque FORCE ROW LEVEL SECURITY;

CREATE POLICY movimentacoes_estoque_tenant_isolation ON movimentacoes_estoque
  FOR ALL TO app_user
  USING (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'platform_admin'
    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );
