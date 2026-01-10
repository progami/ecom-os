-- Fulfillment Orders foundation
-- Adds first-class outbound Fulfillment Orders (FO) and links inventory transactions to them.
-- Also introduces WarehouseKind so we can distinguish 3PL vs Amazon (FBA/AWD) warehouses.

-- CreateEnum: WarehouseKind
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'WarehouseKind'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "WarehouseKind" AS ENUM ('THIRD_PARTY', 'AMAZON_FBA', 'AMAZON_AWD');
  END IF;
END $$;

-- AlterTable: warehouses.kind
ALTER TABLE "warehouses"
  ADD COLUMN IF NOT EXISTS "kind" "WarehouseKind" NOT NULL DEFAULT 'THIRD_PARTY';

-- CreateEnum: FulfillmentOrderStatus
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'FulfillmentOrderStatus'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "FulfillmentOrderStatus" AS ENUM ('DRAFT', 'SHIPPED', 'CANCELLED');
  END IF;
END $$;

-- CreateEnum: FulfillmentOrderLineStatus
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'FulfillmentOrderLineStatus'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "FulfillmentOrderLineStatus" AS ENUM ('PENDING', 'SHIPPED', 'CANCELLED');
  END IF;
END $$;

-- CreateEnum: FulfillmentDestinationType
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'FulfillmentDestinationType'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "FulfillmentDestinationType" AS ENUM ('CUSTOMER', 'AMAZON_FBA', 'TRANSFER');
  END IF;
END $$;

-- CreateEnum: FulfillmentOrderDocumentStage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'FulfillmentOrderDocumentStage'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "FulfillmentOrderDocumentStage" AS ENUM ('PACKING', 'SHIPPING', 'DELIVERY');
  END IF;
END $$;

-- CreateTable: fulfillment_orders
CREATE TABLE IF NOT EXISTS "fulfillment_orders" (
  "id" TEXT NOT NULL,
  "fo_number" TEXT NOT NULL,
  "status" "FulfillmentOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "warehouse_code" TEXT NOT NULL,
  "warehouse_name" TEXT NOT NULL,
  "destination_type" "FulfillmentDestinationType" NOT NULL DEFAULT 'CUSTOMER',
  "destination_name" TEXT,
  "destination_address" TEXT,
  "destination_country" TEXT,
  "shipping_carrier" TEXT,
  "shipping_method" TEXT,
  "tracking_number" TEXT,
  "shipped_date" TIMESTAMP(3),
  "delivered_date" TIMESTAMP(3),
  "external_reference" TEXT,
  "notes" TEXT,
  "created_by" TEXT,
  "created_by_name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fulfillment_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fulfillment_orders_fo_number_key"
  ON "fulfillment_orders" ("fo_number");

CREATE INDEX IF NOT EXISTS "fulfillment_orders_status_idx"
  ON "fulfillment_orders" ("status");

CREATE INDEX IF NOT EXISTS "fulfillment_orders_warehouse_code_idx"
  ON "fulfillment_orders" ("warehouse_code");

-- CreateTable: fulfillment_order_lines
CREATE TABLE IF NOT EXISTS "fulfillment_order_lines" (
  "id" TEXT NOT NULL,
  "fulfillment_order_id" TEXT NOT NULL,
  "sku_code" TEXT NOT NULL,
  "sku_description" TEXT,
  "batch_lot" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "FulfillmentOrderLineStatus" NOT NULL DEFAULT 'PENDING',
  "shipped_quantity" INTEGER NOT NULL DEFAULT 0,
  "line_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fulfillment_order_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fulfillment_order_lines_fulfillment_order_id_sku_code_batch_lot_key"
  ON "fulfillment_order_lines" ("fulfillment_order_id", "sku_code", "batch_lot");

CREATE INDEX IF NOT EXISTS "fulfillment_order_lines_fulfillment_order_id_idx"
  ON "fulfillment_order_lines" ("fulfillment_order_id");

-- CreateTable: fulfillment_order_documents
CREATE TABLE IF NOT EXISTS "fulfillment_order_documents" (
  "id" TEXT NOT NULL,
  "fulfillment_order_id" TEXT NOT NULL,
  "stage" "FulfillmentOrderDocumentStage" NOT NULL,
  "document_type" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "s3_key" TEXT NOT NULL,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploaded_by_id" TEXT,
  "uploaded_by_name" TEXT,
  "metadata" JSONB,
  CONSTRAINT "fulfillment_order_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fulfillment_order_documents_fulfillment_order_id_stage_document_type_key"
  ON "fulfillment_order_documents" ("fulfillment_order_id", "stage", "document_type");

CREATE INDEX IF NOT EXISTS "fulfillment_order_documents_fulfillment_order_id_idx"
  ON "fulfillment_order_documents" ("fulfillment_order_id");

CREATE INDEX IF NOT EXISTS "fulfillment_order_documents_stage_idx"
  ON "fulfillment_order_documents" ("stage");

CREATE INDEX IF NOT EXISTS "fulfillment_order_documents_document_type_idx"
  ON "fulfillment_order_documents" ("document_type");

-- Foreign keys: fulfillment_order_lines -> fulfillment_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'fulfillment_order_lines_fulfillment_order_id_fkey'
      AND n.nspname = current_schema()
  ) THEN
    ALTER TABLE "fulfillment_order_lines"
      ADD CONSTRAINT "fulfillment_order_lines_fulfillment_order_id_fkey"
      FOREIGN KEY ("fulfillment_order_id") REFERENCES "fulfillment_orders"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Foreign keys: fulfillment_order_documents -> fulfillment_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'fulfillment_order_documents_fulfillment_order_id_fkey'
      AND n.nspname = current_schema()
  ) THEN
    ALTER TABLE "fulfillment_order_documents"
      ADD CONSTRAINT "fulfillment_order_documents_fulfillment_order_id_fkey"
      FOREIGN KEY ("fulfillment_order_id") REFERENCES "fulfillment_orders"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable: inventory_transactions links
ALTER TABLE "inventory_transactions"
  ADD COLUMN IF NOT EXISTS "fulfillment_order_id" TEXT;
ALTER TABLE "inventory_transactions"
  ADD COLUMN IF NOT EXISTS "fulfillment_order_line_id" TEXT;

CREATE INDEX IF NOT EXISTS "idx_inventory_transactions_fulfillment_order"
  ON "inventory_transactions" ("fulfillment_order_id");
CREATE INDEX IF NOT EXISTS "idx_inventory_transactions_fulfillment_order_line"
  ON "inventory_transactions" ("fulfillment_order_line_id");

-- Foreign keys: inventory_transactions -> fulfillment_orders/lines
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'inventory_transactions_fulfillment_order_id_fkey'
      AND n.nspname = current_schema()
  ) THEN
    ALTER TABLE "inventory_transactions"
      ADD CONSTRAINT "inventory_transactions_fulfillment_order_id_fkey"
      FOREIGN KEY ("fulfillment_order_id") REFERENCES "fulfillment_orders"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'inventory_transactions_fulfillment_order_line_id_fkey'
      AND n.nspname = current_schema()
  ) THEN
    ALTER TABLE "inventory_transactions"
      ADD CONSTRAINT "inventory_transactions_fulfillment_order_line_id_fkey"
      FOREIGN KEY ("fulfillment_order_line_id") REFERENCES "fulfillment_order_lines"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

