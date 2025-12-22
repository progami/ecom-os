-- Supplier master data + SKU batch defaults

-- 1) Add default pallet configuration fields to SKU batches
ALTER TABLE "public"."sku_batches"
  ADD COLUMN IF NOT EXISTS "storage_cartons_per_pallet" INTEGER,
  ADD COLUMN IF NOT EXISTS "shipping_cartons_per_pallet" INTEGER;

ALTER TABLE "public"."sku_batches"
  DROP CONSTRAINT IF EXISTS "sku_batches_storage_cartons_per_pallet_check";
ALTER TABLE "public"."sku_batches"
  ADD CONSTRAINT "sku_batches_storage_cartons_per_pallet_check"
  CHECK (
    "storage_cartons_per_pallet" IS NULL
    OR "storage_cartons_per_pallet" > 0
  );

ALTER TABLE "public"."sku_batches"
  DROP CONSTRAINT IF EXISTS "sku_batches_shipping_cartons_per_pallet_check";
ALTER TABLE "public"."sku_batches"
  ADD CONSTRAINT "sku_batches_shipping_cartons_per_pallet_check"
  CHECK (
    "shipping_cartons_per_pallet" IS NULL
    OR "shipping_cartons_per_pallet" > 0
  );

-- 2) Create suppliers table
CREATE TABLE IF NOT EXISTS "public"."suppliers" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contact_name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_name_key"
  ON "public"."suppliers" ("name");

CREATE INDEX IF NOT EXISTS "suppliers_is_active_idx"
  ON "public"."suppliers" ("is_active");

-- 3) Backfill from existing inbound transactions (best-effort)
INSERT INTO "public"."suppliers" ("id", "name")
SELECT gen_random_uuid()::text, supplier
FROM "public"."inventory_transactions"
WHERE "transaction_type" = 'RECEIVE'
  AND supplier IS NOT NULL
  AND BTRIM(supplier) <> ''
GROUP BY supplier
ON CONFLICT ("name") DO NOTHING;

