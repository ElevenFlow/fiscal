/*
  Warnings:

  - You are about to drop the column `clerk_user_id` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "cest_descricao_trgm";

-- DropIndex
DROP INDEX "cfop_descricao_trgm";

-- DropIndex
DROP INDEX "lc116_descricao_trgm";

-- DropIndex
DROP INDEX "ncm_descricao_trgm";

-- DropIndex
DROP INDEX "users_clerk_user_id_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "clerk_user_id",
ADD COLUMN     "email_verified_at" TIMESTAMP(3),
ADD COLUMN     "password_changed_at" TIMESTAMP(3),
ADD COLUMN     "password_hash" VARCHAR(128);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" CHAR(64) NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "sessions_refresh_token_hash_idx" ON "sessions"("refresh_token_hash");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
