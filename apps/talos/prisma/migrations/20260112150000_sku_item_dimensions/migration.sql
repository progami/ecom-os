-- Add physical (unpackaged) item dimensions to SKU records.
ALTER TABLE "skus" ADD COLUMN "item_dimensions_cm" TEXT;
ALTER TABLE "skus" ADD COLUMN "item_length_cm" DECIMAL(8, 2);
ALTER TABLE "skus" ADD COLUMN "item_width_cm" DECIMAL(8, 2);
ALTER TABLE "skus" ADD COLUMN "item_height_cm" DECIMAL(8, 2);
ALTER TABLE "skus" ADD COLUMN "item_weight_kg" DECIMAL(8, 3);

