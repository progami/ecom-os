-- Increase unit_cost precision to support supplier pricing (e.g., 0.613).
ALTER TABLE "purchase_order_lines"
  ALTER COLUMN "unit_cost" TYPE NUMERIC(12, 4)
  USING "unit_cost"::NUMERIC(12, 4);

-- Standardize unit_cost to mean per-unit price (not per-carton) using the backfilled totals.
UPDATE "purchase_order_lines"
SET "unit_cost" = ROUND(("total_cost" / NULLIF("units_ordered", 0)), 4)
WHERE "total_cost" IS NOT NULL
  AND "units_ordered" > 0;
