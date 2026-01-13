-- Rename dimension columns from length/width/height to side1/side2/side3
-- This change makes it clearer that these are simply three measurements
-- without implying specific orientation (especially for Amazon-imported data)

-- SKUs table
ALTER TABLE "skus" RENAME COLUMN "unit_length_cm" TO "unit_side1_cm";
ALTER TABLE "skus" RENAME COLUMN "unit_width_cm" TO "unit_side2_cm";
ALTER TABLE "skus" RENAME COLUMN "unit_height_cm" TO "unit_side3_cm";
ALTER TABLE "skus" RENAME COLUMN "item_length_cm" TO "item_side1_cm";
ALTER TABLE "skus" RENAME COLUMN "item_width_cm" TO "item_side2_cm";
ALTER TABLE "skus" RENAME COLUMN "item_height_cm" TO "item_side3_cm";
ALTER TABLE "skus" RENAME COLUMN "carton_length_cm" TO "carton_side1_cm";
ALTER TABLE "skus" RENAME COLUMN "carton_width_cm" TO "carton_side2_cm";
ALTER TABLE "skus" RENAME COLUMN "carton_height_cm" TO "carton_side3_cm";

-- SKU Batches table
ALTER TABLE "sku_batches" RENAME COLUMN "unit_length_cm" TO "unit_side1_cm";
ALTER TABLE "sku_batches" RENAME COLUMN "unit_width_cm" TO "unit_side2_cm";
ALTER TABLE "sku_batches" RENAME COLUMN "unit_height_cm" TO "unit_side3_cm";
ALTER TABLE "sku_batches" RENAME COLUMN "carton_length_cm" TO "carton_side1_cm";
ALTER TABLE "sku_batches" RENAME COLUMN "carton_width_cm" TO "carton_side2_cm";
ALTER TABLE "sku_batches" RENAME COLUMN "carton_height_cm" TO "carton_side3_cm";

-- Purchase Order Lines table
ALTER TABLE "purchase_order_lines" RENAME COLUMN "carton_length_cm" TO "carton_side1_cm";
ALTER TABLE "purchase_order_lines" RENAME COLUMN "carton_width_cm" TO "carton_side2_cm";
ALTER TABLE "purchase_order_lines" RENAME COLUMN "carton_height_cm" TO "carton_side3_cm";
