-- Warehouse SKU storage configuration
-- Moves cartons-per-pallet configuration from SKU/Batches to warehouse-specific settings.

-- CreateTable
CREATE TABLE IF NOT EXISTS "warehouse_sku_storage_configs" (
  "id" TEXT NOT NULL,
  "warehouse_id" TEXT NOT NULL,
  "sku_id" TEXT NOT NULL,
  "storage_cartons_per_pallet" INTEGER,
  "shipping_cartons_per_pallet" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "warehouse_sku_storage_configs_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "warehouse_sku_storage_configs"
  DROP CONSTRAINT IF EXISTS "warehouse_sku_storage_configs_warehouse_id_fkey";
ALTER TABLE "warehouse_sku_storage_configs"
  ADD CONSTRAINT "warehouse_sku_storage_configs_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "warehouse_sku_storage_configs"
  DROP CONSTRAINT IF EXISTS "warehouse_sku_storage_configs_sku_id_fkey";
ALTER TABLE "warehouse_sku_storage_configs"
  ADD CONSTRAINT "warehouse_sku_storage_configs_sku_id_fkey"
  FOREIGN KEY ("sku_id") REFERENCES "skus"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "warehouse_sku_storage_configs_warehouse_id_sku_id_key"
  ON "warehouse_sku_storage_configs" ("warehouse_id", "sku_id");
CREATE INDEX IF NOT EXISTS "warehouse_sku_storage_configs_warehouse_id_idx"
  ON "warehouse_sku_storage_configs" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "warehouse_sku_storage_configs_sku_id_idx"
  ON "warehouse_sku_storage_configs" ("sku_id");

-- Check constraints
ALTER TABLE "warehouse_sku_storage_configs"
  DROP CONSTRAINT IF EXISTS "warehouse_sku_storage_configs_storage_cartons_per_pallet_check";
ALTER TABLE "warehouse_sku_storage_configs"
  ADD CONSTRAINT "warehouse_sku_storage_configs_storage_cartons_per_pallet_check"
  CHECK (
    "storage_cartons_per_pallet" IS NULL
    OR "storage_cartons_per_pallet" > 0
  );

ALTER TABLE "warehouse_sku_storage_configs"
  DROP CONSTRAINT IF EXISTS "warehouse_sku_storage_configs_shipping_cartons_per_pallet_check";
ALTER TABLE "warehouse_sku_storage_configs"
  ADD CONSTRAINT "warehouse_sku_storage_configs_shipping_cartons_per_pallet_check"
  CHECK (
    "shipping_cartons_per_pallet" IS NULL
    OR "shipping_cartons_per_pallet" > 0
  );

-- SKU batch pallet columns are no longer required (warehouse-specific config owns these now).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'sku_batches'
      AND column_name = 'storage_cartons_per_pallet'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "sku_batches"
      ALTER COLUMN "storage_cartons_per_pallet" DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'sku_batches'
      AND column_name = 'shipping_cartons_per_pallet'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "sku_batches"
      ALTER COLUMN "shipping_cartons_per_pallet" DROP NOT NULL;
  END IF;
END $$;

-- Backfill warehouse SKU configs from DEFAULT batch values (fallback to 48).
INSERT INTO "warehouse_sku_storage_configs" (
  "id",
  "warehouse_id",
  "sku_id",
  "storage_cartons_per_pallet",
  "shipping_cartons_per_pallet"
)
SELECT
  gen_random_uuid()::text,
  w.id,
  s.id,
  COALESCE(d.storage_cartons_per_pallet, 48),
  COALESCE(d.shipping_cartons_per_pallet, 48)
FROM "warehouses" w
CROSS JOIN "skus" s
LEFT JOIN "sku_batches" d
  ON d.sku_id = s.id AND UPPER(d.batch_code) = 'DEFAULT'
ON CONFLICT ("warehouse_id", "sku_id") DO NOTHING;

