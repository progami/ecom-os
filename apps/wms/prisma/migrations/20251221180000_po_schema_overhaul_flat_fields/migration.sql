-- PO Schema Overhaul (Flat Stage Fields + Lines/Containers)
-- - Warehouse selection moved to Stage 4 (warehouse_code/name become nullable)
-- - Adds flat stage fields for manufacturing/ocean/warehouse/shipped
-- - Adds purchase_order_containers table
-- - Adds currency/received fields on purchase_order_lines
-- - Restores global uniqueness on order_number

-- 1) Relax warehouse requirements (selected later in workflow)
ALTER TABLE "public"."purchase_orders"
  ALTER COLUMN "warehouse_code" DROP NOT NULL,
  ALTER COLUMN "warehouse_name" DROP NOT NULL;

-- 2) Replace warehouse-scoped unique with global order_number unique
-- Ensure existing data can satisfy the new uniqueness constraint by
-- disambiguating any duplicates (previously allowed across warehouses).
WITH ranked_orders AS (
  SELECT
    "id",
    "order_number",
    "warehouse_code",
    ROW_NUMBER() OVER (
      PARTITION BY "order_number"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS rn
  FROM "public"."purchase_orders"
)
UPDATE "public"."purchase_orders" AS po
SET "order_number" = ranked_orders."order_number" || '::' || COALESCE(ranked_orders."warehouse_code", 'NA') || '-' || ranked_orders."id"
FROM ranked_orders
WHERE po."id" = ranked_orders."id"
  AND ranked_orders.rn > 1;

DROP INDEX IF EXISTS "purchase_orders_warehouse_code_order_number_key";
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_order_number_key"
  ON "public"."purchase_orders" ("order_number");

-- 3) Add Stage 2 (Manufacturing) flat fields
ALTER TABLE "public"."purchase_orders"
  ADD COLUMN IF NOT EXISTS "proforma_invoice_number" TEXT,
  ADD COLUMN IF NOT EXISTS "proforma_invoice_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "factory_name" TEXT,
  ADD COLUMN IF NOT EXISTS "manufacturing_start_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expected_completion_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "actual_completion_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "total_weight_kg" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "total_volume_cbm" DECIMAL(10, 3),
  ADD COLUMN IF NOT EXISTS "total_cartons" INTEGER,
  ADD COLUMN IF NOT EXISTS "total_pallets" INTEGER,
  ADD COLUMN IF NOT EXISTS "packaging_notes" TEXT;

-- 4) Add Stage 3 (Ocean) flat fields
ALTER TABLE "public"."purchase_orders"
  ADD COLUMN IF NOT EXISTS "master_bill_of_lading" TEXT,
  ADD COLUMN IF NOT EXISTS "commercial_invoice_number" TEXT,
  ADD COLUMN IF NOT EXISTS "vessel_name" TEXT,
  ADD COLUMN IF NOT EXISTS "voyage_number" TEXT,
  ADD COLUMN IF NOT EXISTS "port_of_loading" TEXT,
  ADD COLUMN IF NOT EXISTS "port_of_discharge" TEXT,
  ADD COLUMN IF NOT EXISTS "estimated_departure" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "estimated_arrival" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "actual_departure" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "actual_arrival" TIMESTAMP(3);

-- 5) Add Stage 4 (Warehouse) flat fields
ALTER TABLE "public"."purchase_orders"
  ADD COLUMN IF NOT EXISTS "customs_entry_number" TEXT,
  ADD COLUMN IF NOT EXISTS "customs_cleared_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "duty_amount" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "duty_currency" TEXT,
  ADD COLUMN IF NOT EXISTS "surrender_bl_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "transaction_cert_number" TEXT,
  ADD COLUMN IF NOT EXISTS "received_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "discrepancy_notes" TEXT;

-- 6) Add Stage 5 (Shipped) flat fields
ALTER TABLE "public"."purchase_orders"
  ADD COLUMN IF NOT EXISTS "ship_to_name" TEXT,
  ADD COLUMN IF NOT EXISTS "ship_to_address" TEXT,
  ADD COLUMN IF NOT EXISTS "ship_to_city" TEXT,
  ADD COLUMN IF NOT EXISTS "ship_to_country" TEXT,
  ADD COLUMN IF NOT EXISTS "ship_to_postal_code" TEXT,
  ADD COLUMN IF NOT EXISTS "shipping_carrier" TEXT,
  ADD COLUMN IF NOT EXISTS "shipping_method" TEXT,
  ADD COLUMN IF NOT EXISTS "tracking_number" TEXT,
  ADD COLUMN IF NOT EXISTS "shipped_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "proof_of_delivery_ref" TEXT,
  ADD COLUMN IF NOT EXISTS "delivered_date" TIMESTAMP(3);

-- 7) Add shipped approval tracking (separate from shipped_date)
ALTER TABLE "public"."purchase_orders"
  ADD COLUMN IF NOT EXISTS "shipped_approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "shipped_approved_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "shipped_approved_by_name" TEXT;

-- 8) Add line-level fields
ALTER TABLE "public"."purchase_order_lines"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "quantity_received" INTEGER,
  ADD COLUMN IF NOT EXISTS "line_notes" TEXT;

-- Prevent negative/over-received quantities at the DB level.
ALTER TABLE "public"."purchase_order_lines"
  DROP CONSTRAINT IF EXISTS "purchase_order_lines_quantity_received_check";
ALTER TABLE "public"."purchase_order_lines"
  ADD CONSTRAINT "purchase_order_lines_quantity_received_check"
  CHECK (
    "quantity_received" IS NULL
    OR ("quantity_received" >= 0 AND "quantity_received" <= "quantity")
  );

-- 9) Add containers table (Stage 3: Ocean)
CREATE TABLE IF NOT EXISTS "public"."purchase_order_containers" (
  "id" TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "container_number" TEXT NOT NULL,
  "container_size" TEXT NOT NULL,
  "seal_number" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_order_containers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."purchase_order_containers"
  DROP CONSTRAINT IF EXISTS "purchase_order_containers_purchase_order_id_fkey";
ALTER TABLE "public"."purchase_order_containers"
  ADD CONSTRAINT "purchase_order_containers_purchase_order_id_fkey"
  FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce container integrity
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_order_containers_purchase_order_id_container_number_key"
  ON "public"."purchase_order_containers" ("purchase_order_id", "container_number");
CREATE INDEX IF NOT EXISTS "purchase_order_containers_purchase_order_id_idx"
  ON "public"."purchase_order_containers" ("purchase_order_id");

ALTER TABLE "public"."purchase_order_containers"
  DROP CONSTRAINT IF EXISTS "purchase_order_containers_container_size_check";
ALTER TABLE "public"."purchase_order_containers"
  ADD CONSTRAINT "purchase_order_containers_container_size_check"
  CHECK ("container_size" IN ('20FT', '40FT', '40HC', '45HC'));

-- 10) Helpful index for warehouse filtering (now nullable)
CREATE INDEX IF NOT EXISTS "purchase_orders_warehouse_code_idx"
  ON "public"."purchase_orders" ("warehouse_code");
