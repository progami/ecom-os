DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'GoodsReceiptStatus'
  ) THEN
    CREATE TYPE "public"."GoodsReceiptStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED', 'RECONCILED');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'WarehouseInvoiceStatus'
  ) THEN
    CREATE TYPE "public"."WarehouseInvoiceStatus" AS ENUM ('DRAFT', 'IMPORTED', 'MATCHED', 'DISPUTED', 'CLOSED');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "public"."goods_receipts" (
  "id" TEXT PRIMARY KEY,
  "purchase_order_id" TEXT NOT NULL,
  "status" "public"."GoodsReceiptStatus" NOT NULL DEFAULT 'DRAFT',
  "reference_number" TEXT,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "received_by_id" TEXT,
  "received_by_name" TEXT,
  "warehouse_id" TEXT,
  "warehouse_code" TEXT NOT NULL,
  "warehouse_name" TEXT NOT NULL,
  "notes" TEXT,
  "attachments" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_goods_receipts_purchase_order" ON "public"."goods_receipts" ("purchase_order_id");
CREATE INDEX IF NOT EXISTS "idx_goods_receipts_warehouse" ON "public"."goods_receipts" ("warehouse_code");

ALTER TABLE "public"."goods_receipts"
  ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey"
  FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."goods_receipts"
  ADD CONSTRAINT "goods_receipts_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "public"."goods_receipt_lines" (
  "id" TEXT PRIMARY KEY,
  "goods_receipt_id" TEXT NOT NULL,
  "purchase_order_line_id" TEXT,
  "sku_code" TEXT NOT NULL,
  "sku_description" TEXT,
  "batch_lot" TEXT,
  "quantity" INTEGER NOT NULL,
  "variance_quantity" INTEGER NOT NULL DEFAULT 0,
  "storage_cartons_per_pallet" INTEGER,
  "shipping_cartons_per_pallet" INTEGER,
  "attachments" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_goods_receipt_lines_receipt" ON "public"."goods_receipt_lines" ("goods_receipt_id");
CREATE INDEX IF NOT EXISTS "idx_goods_receipt_lines_po_line" ON "public"."goods_receipt_lines" ("purchase_order_line_id");

ALTER TABLE "public"."goods_receipt_lines"
  ADD CONSTRAINT "goods_receipt_lines_receipt_id_fkey"
  FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."goods_receipt_lines"
  ADD CONSTRAINT "goods_receipt_lines_po_line_id_fkey"
  FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "public"."warehouse_invoices" (
  "id" TEXT PRIMARY KEY,
  "invoice_number" TEXT NOT NULL,
  "status" "public"."WarehouseInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "issued_at" TIMESTAMP(3),
  "due_at" TIMESTAMP(3),
  "warehouse_id" TEXT,
  "warehouse_code" TEXT NOT NULL,
  "warehouse_name" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "subtotal" NUMERIC(14, 2) NOT NULL DEFAULT 0,
  "total" NUMERIC(14, 2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_warehouse_invoices_number" ON "public"."warehouse_invoices" ("invoice_number");
CREATE INDEX IF NOT EXISTS "idx_warehouse_invoices_status" ON "public"."warehouse_invoices" ("status");
CREATE INDEX IF NOT EXISTS "idx_warehouse_invoices_warehouse" ON "public"."warehouse_invoices" ("warehouse_code");

ALTER TABLE "public"."warehouse_invoices"
  ADD CONSTRAINT "warehouse_invoices_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "public"."warehouse_invoice_lines" (
  "id" TEXT PRIMARY KEY,
  "warehouse_invoice_id" TEXT NOT NULL,
  "purchase_order_id" TEXT,
  "purchase_order_line_id" TEXT,
  "goods_receipt_line_id" TEXT,
  "charge_code" TEXT NOT NULL,
  "description" TEXT,
  "quantity" NUMERIC(14, 4) NOT NULL DEFAULT 0,
  "unit_rate" NUMERIC(14, 4) NOT NULL DEFAULT 0,
  "total" NUMERIC(14, 2) NOT NULL DEFAULT 0,
  "variance_amount" NUMERIC(14, 2),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_invoice_lines_invoice" ON "public"."warehouse_invoice_lines" ("warehouse_invoice_id");
CREATE INDEX IF NOT EXISTS "idx_invoice_lines_po" ON "public"."warehouse_invoice_lines" ("purchase_order_id");
CREATE INDEX IF NOT EXISTS "idx_invoice_lines_receipt_line" ON "public"."warehouse_invoice_lines" ("goods_receipt_line_id");

ALTER TABLE "public"."warehouse_invoice_lines"
  ADD CONSTRAINT "warehouse_invoice_lines_invoice_id_fkey"
  FOREIGN KEY ("warehouse_invoice_id") REFERENCES "public"."warehouse_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."warehouse_invoice_lines"
  ADD CONSTRAINT "warehouse_invoice_lines_po_id_fkey"
  FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."warehouse_invoice_lines"
  ADD CONSTRAINT "warehouse_invoice_lines_po_line_id_fkey"
  FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."warehouse_invoice_lines"
  ADD CONSTRAINT "warehouse_invoice_lines_receipt_line_id_fkey"
  FOREIGN KEY ("goods_receipt_line_id") REFERENCES "public"."goods_receipt_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
