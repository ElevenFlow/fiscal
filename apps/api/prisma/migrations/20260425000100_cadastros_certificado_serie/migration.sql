-- DropForeignKey
ALTER TABLE "contabilidade_empresas" DROP CONSTRAINT "contabilidade_empresas_contabilidade_id_fkey";

-- DropForeignKey
ALTER TABLE "contabilidade_empresas" DROP CONSTRAINT "contabilidade_empresas_empresa_id_fkey";

-- DropForeignKey
ALTER TABLE "user_memberships" DROP CONSTRAINT "user_memberships_user_id_fkey";

-- AlterTable
ALTER TABLE "audit_log" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "contabilidades" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cnae" VARCHAR(10),
ADD COLUMN     "contatos" JSONB,
ADD COLUMN     "endereco" JSONB,
ADD COLUMN     "ie" TEXT,
ADD COLUMN     "im" TEXT,
ADD COLUMN     "nome_fantasia" TEXT,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_memberships" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tipo_pessoa" TEXT NOT NULL,
    "cpf_cnpj" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "inscricao_est" TEXT,
    "inscricao_mun" TEXT,
    "contribuinte_icms" TEXT,
    "endereco" JSONB NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedores" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cpf_cnpj" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "inscricao_est" TEXT,
    "endereco" JSONB NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "contato_comercial" TEXT,
    "condicoes_padrao" JSONB,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ncm" VARCHAR(8) NOT NULL,
    "cest" VARCHAR(7),
    "cfop_padrao" VARCHAR(4),
    "cst_icms" VARCHAR(3),
    "csosn" VARCHAR(3),
    "origem_mercadoria" INTEGER NOT NULL DEFAULT 0,
    "unidade" VARCHAR(6) NOT NULL,
    "peso" DECIMAL(10,3),
    "categoria" TEXT,
    "preco_custo" DECIMAL(15,4),
    "margem" DECIMAL(5,2),
    "preco_venda" DECIMAL(15,4) NOT NULL,
    "aliquota_icms" DECIMAL(5,2),
    "aliquota_ipi" DECIMAL(5,2),
    "aliquota_pis" DECIMAL(5,2),
    "aliquota_cofins" DECIMAL(5,2),
    "estoque_inicial" DECIMAL(15,3),
    "estoque_minimo" DECIMAL(15,3),
    "estoque_maximo" DECIMAL(15,3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "codigo_interno" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "codigo_municipal" TEXT NOT NULL,
    "cnae" VARCHAR(10),
    "preco_padrao" DECIMAL(15,4) NOT NULL,
    "aliquota_iss" DECIMAL(5,2) NOT NULL,
    "retencao_ir" DECIMAL(5,2),
    "retencao_inss" DECIMAL(5,2),
    "retencao_pis" DECIMAL(5,2),
    "retencao_cofins" DECIMAL(5,2),
    "retencao_csll" DECIMAL(5,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificados_digitais" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "s3_key" TEXT NOT NULL,
    "s3_version_id" TEXT,
    "encrypted_dek" BYTEA NOT NULL,
    "kms_key_id" TEXT NOT NULL,
    "cn" TEXT NOT NULL,
    "cnpj_certificado" TEXT NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "not_before" TIMESTAMPTZ(6) NOT NULL,
    "not_after" TIMESTAMPTZ(6) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificados_digitais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas_certificado" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "certificado_id" UUID NOT NULL,
    "tier" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "dias_restantes" INTEGER NOT NULL,
    "gerado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "resolvido_em" TIMESTAMPTZ(6),

    CONSTRAINT "alertas_certificado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series_fiscais" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "modelo" TEXT NOT NULL,
    "serie" INTEGER NOT NULL,
    "proximo_numero" BIGINT NOT NULL DEFAULT 1,
    "ambiente" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_fiscais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cnpj_cache" (
    "cnpj" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cnpj_cache_pkey" PRIMARY KEY ("cnpj")
);

-- CreateTable
CREATE TABLE "cep_cache" (
    "cep" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cep_cache_pkey" PRIMARY KEY ("cep")
);

-- CreateTable
CREATE TABLE "ncm" (
    "codigo" VARCHAR(8) NOT NULL,
    "descricao" TEXT NOT NULL,
    "vigente_ate" TIMESTAMP(3),
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ncm_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "cest" (
    "codigo" VARCHAR(7) NOT NULL,
    "descricao" TEXT NOT NULL,
    "ncm_relacionado" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cest_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "cfop" (
    "codigo" VARCHAR(4) NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cfop_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "lc116" (
    "codigo" VARCHAR(10) NOT NULL,
    "descricao" TEXT NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lc116_pkey" PRIMARY KEY ("codigo")
);

-- CreateIndex
CREATE INDEX "clientes_tenant_id_created_at_idx" ON "clientes"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "clientes_tenant_id_nome_idx" ON "clientes"("tenant_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_tenant_id_cpf_cnpj_key" ON "clientes"("tenant_id", "cpf_cnpj");

-- CreateIndex
CREATE INDEX "fornecedores_tenant_id_created_at_idx" ON "fornecedores"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_tenant_id_cpf_cnpj_key" ON "fornecedores"("tenant_id", "cpf_cnpj");

-- CreateIndex
CREATE INDEX "produtos_tenant_id_ncm_idx" ON "produtos"("tenant_id", "ncm");

-- CreateIndex
CREATE INDEX "produtos_tenant_id_created_at_idx" ON "produtos"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "produtos_tenant_id_codigo_key" ON "produtos"("tenant_id", "codigo");

-- CreateIndex
CREATE INDEX "servicos_tenant_id_codigo_municipal_idx" ON "servicos"("tenant_id", "codigo_municipal");

-- CreateIndex
CREATE UNIQUE INDEX "servicos_tenant_id_codigo_interno_key" ON "servicos"("tenant_id", "codigo_interno");

-- CreateIndex
CREATE INDEX "certificados_digitais_tenant_id_ativo_idx" ON "certificados_digitais"("tenant_id", "ativo");

-- CreateIndex
CREATE INDEX "certificados_digitais_tenant_id_not_after_idx" ON "certificados_digitais"("tenant_id", "not_after");

-- CreateIndex
CREATE INDEX "alertas_certificado_tenant_id_resolvido_idx" ON "alertas_certificado"("tenant_id", "resolvido");

-- CreateIndex
CREATE INDEX "alertas_certificado_tenant_id_gerado_em_idx" ON "alertas_certificado"("tenant_id", "gerado_em" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "alertas_certificado_certificado_id_tier_key" ON "alertas_certificado"("certificado_id", "tier");

-- CreateIndex
CREATE INDEX "series_fiscais_tenant_id_ativa_idx" ON "series_fiscais"("tenant_id", "ativa");

-- CreateIndex
CREATE UNIQUE INDEX "series_fiscais_empresa_id_modelo_serie_key" ON "series_fiscais"("empresa_id", "modelo", "serie");

-- CreateIndex
CREATE INDEX "cnpj_cache_expires_at_idx" ON "cnpj_cache"("expires_at");

-- CreateIndex
CREATE INDEX "cep_cache_expires_at_idx" ON "cep_cache"("expires_at");

-- CreateIndex
CREATE INDEX "ncm_descricao_idx" ON "ncm"("descricao");

-- CreateIndex
CREATE INDEX "cfop_tipo_idx" ON "cfop"("tipo");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "empresas"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fornecedores" ADD CONSTRAINT "fornecedores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "empresas"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "empresas"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicos" ADD CONSTRAINT "servicos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "empresas"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados_digitais" ADD CONSTRAINT "certificados_digitais_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "empresas"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_certificado" ADD CONSTRAINT "alertas_certificado_certificado_id_fkey" FOREIGN KEY ("certificado_id") REFERENCES "certificados_digitais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_fiscais" ADD CONSTRAINT "series_fiscais_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "empresas"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidade_empresas" ADD CONSTRAINT "contabilidade_empresas_contabilidade_id_fkey" FOREIGN KEY ("contabilidade_id") REFERENCES "contabilidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidade_empresas" ADD CONSTRAINT "contabilidade_empresas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Plan 02-01 — Grants e índices customizados (não cobertos por prisma diff)
-- ============================================================================

-- Grants para app_user (NOBYPASSRLS) — tabelas multi-tenant (Phase 2)
GRANT SELECT, INSERT, UPDATE, DELETE ON clientes TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON fornecedores TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON produtos TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON servicos TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON certificados_digitais TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON alertas_certificado TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON series_fiscais TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON cnpj_cache TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON cep_cache TO app_user;

-- Índice parcial: 1 cert ativo por empresa (T-02-01-06)
-- Mesmo sob race condition concorrente, Postgres garante UNIQUE — sem necessidade
-- de SELECT ... FOR UPDATE no app code.
CREATE UNIQUE INDEX certificados_digitais_one_active_per_tenant
  ON certificados_digitais (tenant_id) WHERE ativo = true;
