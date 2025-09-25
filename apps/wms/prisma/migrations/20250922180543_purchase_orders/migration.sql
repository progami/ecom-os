-- CreateEnum
CREATE TYPE "public"."PurchaseOrderType" AS ENUM ('PURCHASE', 'FULFILLMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."PurchaseOrderStatus" AS ENUM ('DRAFT', 'POSTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."PurchaseOrderLineStatus" AS ENUM ('PENDING', 'POSTED');

-- AlterTable
ALTER TABLE "public"."inventory_transactions" ADD COLUMN     "purchase_order_id" TEXT,
ADD COLUMN     "purchase_order_line_id" TEXT;

-- CreateTable
CREATE TABLE "public"."purchase_orders" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "type" "public"."PurchaseOrderType" NOT NULL,
    "status" "public"."PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "warehouse_code" TEXT NOT NULL,
    "warehouse_name" TEXT NOT NULL,
    "counterparty_name" TEXT,
    "expected_date" TIMESTAMP(3),
    "posted_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_order_lines" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "sku_code" TEXT NOT NULL,
    "sku_description" TEXT,
    "batch_lot" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(12,2),
    "status" "public"."PurchaseOrderLineStatus" NOT NULL DEFAULT 'PENDING',
    "posted_quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_order_number_key" ON "public"."purchase_orders"("order_number");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "public"."purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_type_status_idx" ON "public"."purchase_orders"("type", "status");

-- CreateIndex
CREATE INDEX "purchase_order_lines_purchase_order_id_idx" ON "public"."purchase_order_lines"("purchase_order_id");

-- CreateIndex
CREATE INDEX "idx_inventory_transactions_purchase_order" ON "public"."inventory_transactions"("purchase_order_id");

-- CreateIndex
CREATE INDEX "idx_inventory_transactions_purchase_order_line" ON "public"."inventory_transactions"("purchase_order_line_id");

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_purchase_order_line_id_fkey" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

