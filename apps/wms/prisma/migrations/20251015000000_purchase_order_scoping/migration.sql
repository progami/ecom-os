-- Adjust purchase order uniqueness to scope by warehouse
DROP INDEX IF EXISTS "purchase_orders_order_number_key";
CREATE UNIQUE INDEX "purchase_orders_warehouse_code_order_number_key"
  ON "public"."purchase_orders" ("warehouse_code", "order_number");

-- Prevent duplicate lines with the same SKU and batch on a purchase order
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_order_lines_purchase_order_id_sku_code_batch_lot_key"
  ON "public"."purchase_order_lines" ("purchase_order_id", "sku_code", "batch_lot");
