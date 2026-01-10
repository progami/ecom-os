-- Snapshot supplier address on purchase orders (avoid dynamic supplier lookups for PDFs).
ALTER TABLE "purchase_orders"
  ADD COLUMN "counterparty_address" text;

-- Snapshot packaging data on PO lines (avoid dynamic SKU/batch enrichment after creation).
ALTER TABLE "purchase_order_lines"
  ADD COLUMN "carton_dimensions_cm" text,
  ADD COLUMN "carton_length_cm" numeric(8, 2),
  ADD COLUMN "carton_width_cm" numeric(8, 2),
  ADD COLUMN "carton_height_cm" numeric(8, 2),
  ADD COLUMN "carton_weight_kg" numeric(8, 3),
  ADD COLUMN "packaging_type" text,
  ADD COLUMN "storage_cartons_per_pallet" integer,
  ADD COLUMN "shipping_cartons_per_pallet" integer;

-- Prevent invalid per-pallet values when present.
ALTER TABLE "purchase_order_lines"
  ADD CONSTRAINT "purchase_order_lines_storage_cartons_per_pallet_check"
  CHECK (storage_cartons_per_pallet IS NULL OR storage_cartons_per_pallet > 0);

ALTER TABLE "purchase_order_lines"
  ADD CONSTRAINT "purchase_order_lines_shipping_cartons_per_pallet_check"
  CHECK (shipping_cartons_per_pallet IS NULL OR shipping_cartons_per_pallet > 0);
