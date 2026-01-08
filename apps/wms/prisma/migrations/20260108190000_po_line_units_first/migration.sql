-- Add units-first fields to PO lines (Sellerboard-style)
ALTER TABLE "purchase_order_lines"
  ADD COLUMN "units_ordered" INTEGER,
  ADD COLUMN "units_per_carton" INTEGER,
  ADD COLUMN "total_cost" NUMERIC(12, 2);

-- Backfill units_per_carton from batch defaults (or SKU defaults), defaulting to 1.
UPDATE "purchase_order_lines" AS pol
SET "units_per_carton" = COALESCE(sb."units_per_carton", s."units_per_carton", 1)
FROM "skus" AS s
LEFT JOIN "sku_batches" AS sb
  ON sb."sku_id" = s."id"
 AND UPPER(sb."batch_code") = UPPER(pol."batch_lot")
WHERE UPPER(s."sku_code") = UPPER(pol."sku_code")
  AND pol."units_per_carton" IS NULL;

UPDATE "purchase_order_lines"
SET "units_per_carton" = 1
WHERE "units_per_carton" IS NULL;

-- Backfill units_ordered from cartons * units_per_carton (existing quantity = cartons).
UPDATE "purchase_order_lines"
SET "units_ordered" = "quantity" * "units_per_carton"
WHERE "units_ordered" IS NULL;

-- Backfill total_cost from existing unit_cost * cartons where present.
UPDATE "purchase_order_lines"
SET "total_cost" = "unit_cost" * "quantity"
WHERE "total_cost" IS NULL
  AND "unit_cost" IS NOT NULL;

ALTER TABLE "purchase_order_lines"
  ALTER COLUMN "units_ordered" SET NOT NULL,
  ALTER COLUMN "units_per_carton" SET NOT NULL;

