-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "ExamNoticeStatus" AS ENUM ('EXPECTED', 'OPEN', 'CLOSED', 'DONE');

-- CreateEnum
CREATE TYPE "SlugRedirectKind" AS ENUM ('COURSE', 'LESSON', 'BLOG_POST', 'EXAM_NOTICE');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "affiliate_commission_bps" INTEGER,
ADD COLUMN     "affiliate_id" TEXT,
ADD COLUMN     "coupon_code" TEXT,
ADD COLUMN     "coupon_id" TEXT,
ADD COLUMN     "discount_cents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "affiliate_commission_bps" INTEGER,
ADD COLUMN     "affiliate_id" TEXT,
ADD COLUMN     "coupon_code" TEXT,
ADD COLUMN     "coupon_id" TEXT,
ADD COLUMN     "discount_cents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "discount_type" "CouponDiscountType" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "applies_to_products" BOOLEAN NOT NULL DEFAULT true,
    "applies_to_plans" BOOLEAN NOT NULL DEFAULT false,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "max_redemptions" INTEGER,
    "max_per_user" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "affiliate_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_products" (
    "coupon_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,

    CONSTRAINT "coupon_products_pkey" PRIMARY KEY ("coupon_id","product_id")
);

-- CreateTable
CREATE TABLE "coupon_plans" (
    "coupon_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,

    CONSTRAINT "coupon_plans_pkey" PRIMARY KEY ("coupon_id","plan_id")
);

-- CreateTable
CREATE TABLE "affiliates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commission_bps" INTEGER NOT NULL,
    "payout_info" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_click_days" (
    "affiliate_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "affiliate_click_days_pkey" PRIMARY KEY ("affiliate_id","day")
);

-- CreateTable
CREATE TABLE "affiliate_payouts" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_payout_items" (
    "payout_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,

    CONSTRAINT "affiliate_payout_items_pkey" PRIMARY KEY ("payout_id","payment_id")
);

-- CreateTable
CREATE TABLE "exam_notices" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "board_id" TEXT,
    "status" "ExamNoticeStatus" NOT NULL DEFAULT 'EXPECTED',
    "registration_ends_on" DATE,
    "exam_date" DATE,
    "vacancies" TEXT NOT NULL DEFAULT '',
    "salary" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "official_url" TEXT,
    "product_id" TEXT,
    "plan_id" TEXT,
    "coupon_code" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_notice_subjects" (
    "notice_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,

    CONSTRAINT "exam_notice_subjects_pkey" PRIMARY KEY ("notice_id","subject_id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "author_id" TEXT,
    "subject_id" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slug_redirects" (
    "id" TEXT NOT NULL,
    "kind" "SlugRedirectKind" NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "old_slug" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slug_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_user_id_key" ON "affiliates"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_code_key" ON "affiliates"("code");

-- CreateIndex
CREATE INDEX "affiliate_payouts_affiliate_id_created_at_idx" ON "affiliate_payouts"("affiliate_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_payout_items_payment_id_key" ON "affiliate_payout_items"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_notices_slug_key" ON "exam_notices"("slug");

-- CreateIndex
CREATE INDEX "exam_notices_is_published_exam_date_idx" ON "exam_notices"("is_published", "exam_date");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_is_published_published_at_idx" ON "blog_posts"("is_published", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "slug_redirects_kind_scope_old_slug_key" ON "slug_redirects"("kind", "scope", "old_slug");

-- CreateIndex
CREATE INDEX "orders_coupon_id_idx" ON "orders"("coupon_id");

-- CreateIndex
CREATE INDEX "orders_affiliate_id_idx" ON "orders"("affiliate_id");

-- CreateIndex
CREATE INDEX "subscriptions_coupon_id_idx" ON "subscriptions"("coupon_id");

-- CreateIndex
CREATE INDEX "subscriptions_affiliate_id_idx" ON "subscriptions"("affiliate_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_products" ADD CONSTRAINT "coupon_products_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_products" ADD CONSTRAINT "coupon_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_plans" ADD CONSTRAINT "coupon_plans_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_plans" ADD CONSTRAINT "coupon_plans_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_click_days" ADD CONSTRAINT "affiliate_click_days_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_payout_items" ADD CONSTRAINT "affiliate_payout_items_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "affiliate_payouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_payout_items" ADD CONSTRAINT "affiliate_payout_items_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_notices" ADD CONSTRAINT "exam_notices_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_notices" ADD CONSTRAINT "exam_notices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_notices" ADD CONSTRAINT "exam_notices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_notice_subjects" ADD CONSTRAINT "exam_notice_subjects_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "exam_notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_notice_subjects" ADD CONSTRAINT "exam_notice_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- -----------------------------------------------------------------------------
-- Travas extras (o Prisma não gera CHECK): o banco recusa dados impossíveis mesmo se
-- algum código tentar gravá-los.
-- -----------------------------------------------------------------------------

-- Cupom: código em maiúsculas (3 a 30 letras/números/hífen/sublinhado); desconto de 1 a 100%
-- ou um valor positivo; vale em pelo menos um tipo de venda; limites e datas coerentes.
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_values_check" CHECK (
  "code" ~ '^[A-Z0-9_-]{3,30}$'
  AND (("discount_type" = 'PERCENT' AND "discount_value" BETWEEN 1 AND 100)
    OR ("discount_type" = 'AMOUNT' AND "discount_value" > 0))
  AND ("applies_to_products" OR "applies_to_plans")
  AND ("max_redemptions" IS NULL OR "max_redemptions" >= 1)
  AND "max_per_user" >= 1
  AND ("starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at")
);

-- Afiliado: código do link em minúsculas (3 a 30); comissão de 0 a 100%.
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_values_check" CHECK (
  "code" ~ '^[a-z0-9-]{3,30}$' AND "commission_bps" BETWEEN 0 AND 10000
);
ALTER TABLE "affiliate_click_days" ADD CONSTRAINT "affiliate_click_days_clicks_check" CHECK ("clicks" >= 0);
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_amount_check" CHECK ("amount_cents" > 0);
ALTER TABLE "affiliate_payout_items" ADD CONSTRAINT "affiliate_payout_items_amount_check" CHECK ("amount_cents" >= 0);

-- Pedido e assinatura: desconto só com cupom (e o código junto); afiliado sempre com a comissão.
ALTER TABLE "orders" ADD CONSTRAINT "orders_marketing_check" CHECK (
  "discount_cents" >= 0
  AND ("coupon_id" IS NOT NULL OR "discount_cents" = 0)
  AND (("coupon_id" IS NULL) = ("coupon_code" IS NULL))
  AND (("affiliate_id" IS NULL) = ("affiliate_commission_bps" IS NULL))
  AND ("affiliate_commission_bps" IS NULL OR "affiliate_commission_bps" BETWEEN 0 AND 10000)
);
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_marketing_check" CHECK (
  "discount_cents" >= 0
  AND ("coupon_id" IS NOT NULL OR "discount_cents" = 0)
  AND (("coupon_id" IS NULL) = ("coupon_code" IS NULL))
  AND (("affiliate_id" IS NULL) = ("affiliate_commission_bps" IS NULL))
  AND ("affiliate_commission_bps" IS NULL OR "affiliate_commission_bps" BETWEEN 0 AND 10000)
);

-- Página de edital: link oficial só https; publicada sempre com data de publicação.
ALTER TABLE "exam_notices" ADD CONSTRAINT "exam_notices_values_check" CHECK (
  ("official_url" IS NULL OR "official_url" ~ '^https://')
  AND (NOT "is_published" OR "published_at" IS NOT NULL)
);

-- Post publicado sempre tem data de publicação.
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_published_check" CHECK (NOT "is_published" OR "published_at" IS NOT NULL);
