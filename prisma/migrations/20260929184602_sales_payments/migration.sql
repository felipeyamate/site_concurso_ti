-- CreateEnum
CREATE TYPE "PaymentProviderKind" AS ENUM ('ASAAS', 'FAKE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'BOLETO', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "PlanCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'OVERDUE', 'PAID', 'REFUND_REQUESTED', 'REFUNDED', 'CHARGEBACK', 'CANCELED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'OVERDUE', 'CONFIRMED', 'RECEIVED', 'REFUND_REQUESTED', 'REFUNDED', 'CHARGEBACK', 'CANCELED');

-- CreateEnum
CREATE TYPE "FiscalInvoiceStatus" AS ENUM ('PENDING', 'SCHEDULED', 'AUTHORIZED', 'PROCESSING_CANCELLATION', 'CANCELED', 'CANCELLATION_DENIED', 'ERROR');

-- DropIndex
DROP INDEX "enrollments_user_id_course_id_key";

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "included_in_subscription" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price_cents" INTEGER NOT NULL,
    "access_days" INTEGER,
    "max_installments" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_courses" (
    "product_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,

    CONSTRAINT "product_courses_pkey" PRIMARY KEY ("product_id","course_id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price_cents" INTEGER NOT NULL,
    "cycle" "PlanCycle" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_profiles" (
    "user_id" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "phone" TEXT,
    "provider_kind" "PaymentProviderKind",
    "provider_customer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_title" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "access_days" INTEGER,
    "method" "PaymentMethod" NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentProviderKind" NOT NULL,
    "provider_payment_id" TEXT,
    "provider_installment_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "refund_requested_at" TIMESTAMP(3),
    "refund_requested_by" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_courses" (
    "order_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,

    CONSTRAINT "order_courses_pkey" PRIMARY KEY ("order_id","course_id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "plan_title" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "cycle" "PlanCycle" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentProviderKind" NOT NULL,
    "provider_subscription_id" TEXT,
    "canceled_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProviderKind" NOT NULL,
    "provider_payment_id" TEXT NOT NULL,
    "order_id" TEXT,
    "subscription_id" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider_status" TEXT NOT NULL,
    "value_cents" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "installment_number" INTEGER,
    "paid_at" TIMESTAMP(3),
    "invoice_url" TEXT,
    "bank_slip_url" TEXT,
    "pix_payload" TEXT,
    "pix_image" TEXT,
    "last_event_at" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProviderKind" NOT NULL,
    "event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "note" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_invoices" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "provider_invoice_id" TEXT,
    "status" "FiscalInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "number" TEXT,
    "pdf_url" TEXT,
    "xml_url" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "orders_provider_payment_id_key" ON "orders"("provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_provider_installment_id_key" ON "orders"("provider_installment_id");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_subscription_id_key" ON "subscriptions"("provider_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_created_at_idx" ON "subscriptions"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_payment_id_key" ON "payments"("provider_payment_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_subscription_id_idx" ON "payments"("subscription_id");

-- CreateIndex
CREATE INDEX "webhook_events_received_at_idx" ON "webhook_events"("received_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_event_id_key" ON "webhook_events"("provider", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_invoices_payment_id_key" ON "fiscal_invoices"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_invoices_provider_invoice_id_key" ON "fiscal_invoices"("provider_invoice_id");

-- CreateIndex
CREATE INDEX "enrollments_course_id_idx" ON "enrollments"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_user_id_course_id_source_key" ON "enrollments"("user_id", "course_id", "source");

-- AddForeignKey
ALTER TABLE "product_courses" ADD CONSTRAINT "product_courses_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_courses" ADD CONSTRAINT "product_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_profiles" ADD CONSTRAINT "billing_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_courses" ADD CONSTRAINT "order_courses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_courses" ADD CONSTRAINT "order_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_invoices" ADD CONSTRAINT "fiscal_invoices_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras extras garantidas pelo PRÓPRIO BANCO (o Prisma não descreve CHECK no schema, então
-- elas ficam só aqui na migração). Mesmo um bug no código não consegue gravar dados assim:
-- 1. Toda cobrança pertence a UMA coisa: um pedido OU uma assinatura (nunca as duas, nunca nenhuma).
ALTER TABLE "payments" ADD CONSTRAINT "payments_single_owner_check"
  CHECK (("order_id" IS NULL) <> ("subscription_id" IS NULL));
-- 2. Preços positivos, parcelas entre 1 e 12 e dias de acesso positivos (quando informados).
ALTER TABLE "products" ADD CONSTRAINT "products_values_check"
  CHECK ("price_cents" > 0 AND "max_installments" BETWEEN 1 AND 12 AND ("access_days" IS NULL OR "access_days" > 0));
ALTER TABLE "plans" ADD CONSTRAINT "plans_price_check" CHECK ("price_cents" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_values_check"
  CHECK ("price_cents" > 0 AND "installments" BETWEEN 1 AND 12);
