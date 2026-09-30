-- Fase 7 — LGPD e produção:
--  - legal_consents: registro de cada aceite dos Termos/Política de privacidade (prova do consentimento);
--  - users.legal_version: versão aceita por último (a área logada pede o aceite quando muda);
--  - users.deleted_at: conta excluída a pedido (a linha fica anonimizada por causa dos registros fiscais);
--  - payments.provider_checked_at: última conferência automática da cobrança no provedor.

-- CreateEnum
CREATE TYPE "ConsentSource" AS ENUM ('SIGN_UP', 'REVIEW');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "provider_checked_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "legal_version" TEXT;

-- CreateTable
CREATE TABLE "legal_consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "source" "ConsentSource" NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_consents_user_id_accepted_at_idx" ON "legal_consents"("user_id", "accepted_at");

-- CreateIndex
CREATE INDEX "payments_status_provider_checked_at_idx" ON "payments"("status", "provider_checked_at");

-- AddForeignKey
ALTER TABLE "legal_consents" ADD CONSTRAINT "legal_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

