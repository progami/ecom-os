-- Add Amazon defaults on SKUs for fee tracking
ALTER TABLE "skus"
  ADD COLUMN "amazon_category" text,
  ADD COLUMN "amazon_size_tier" text,
  ADD COLUMN "amazon_referral_fee_percent" numeric(5, 2),
  ADD COLUMN "amazon_fba_fulfillment_fee" numeric(12, 2);

-- Track FBA fee mismatch alerts per SKU (one row per SKU)
CREATE TYPE "AmazonFbaFeeAlertStatus" AS ENUM (
  'UNKNOWN',
  'MATCH',
  'MISMATCH',
  'NO_ASIN',
  'MISSING_REFERENCE',
  'ERROR'
);

CREATE TABLE "amazon_fba_fee_alerts" (
  "id" text NOT NULL,
  "sku_id" text NOT NULL,
  "reference_size_tier" text,
  "reference_fba_fulfillment_fee" numeric(12, 2),
  "amazon_fba_fulfillment_fee" numeric(12, 2),
  "currency_code" text,
  "listing_price" numeric(12, 2),
  "status" "AmazonFbaFeeAlertStatus" NOT NULL DEFAULT 'UNKNOWN',
  "message" text,
  "checked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "amazon_fba_fee_alerts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "amazon_fba_fee_alerts_sku_id_key" ON "amazon_fba_fee_alerts"("sku_id");
CREATE INDEX "amazon_fba_fee_alerts_status_idx" ON "amazon_fba_fee_alerts"("status");
CREATE INDEX "amazon_fba_fee_alerts_checked_at_idx" ON "amazon_fba_fee_alerts"("checked_at");

ALTER TABLE "amazon_fba_fee_alerts"
  ADD CONSTRAINT "amazon_fba_fee_alerts_sku_id_fkey"
  FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
