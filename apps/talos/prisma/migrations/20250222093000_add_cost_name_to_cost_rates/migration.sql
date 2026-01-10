-- Add cost_name column for more descriptive rate labels
ALTER TABLE "cost_rates"
ADD COLUMN IF NOT EXISTS "cost_name" TEXT;

-- Backfill existing rows using their category label when no name exists
UPDATE "cost_rates"
SET "cost_name" = INITCAP(REPLACE("cost_category"::text, '_', ' '))
WHERE ("cost_name" IS NULL OR TRIM("cost_name") = '')
  AND "cost_category" IS NOT NULL;

-- Drop old uniqueness/indexes that only referenced category
ALTER TABLE "cost_rates"
DROP CONSTRAINT IF EXISTS "cost_rates_warehouse_id_cost_category_key";

DROP INDEX IF EXISTS "cost_rates_warehouse_id_cost_category_effectiveDate_idx";
DROP INDEX IF EXISTS "cost_rates_warehouse_id_cost_category_effective_date_idx";

-- Enforce new name-based uniqueness and index
ALTER TABLE "cost_rates"
ALTER COLUMN "cost_name" SET NOT NULL;

ALTER TABLE "cost_rates"
ADD CONSTRAINT IF NOT EXISTS "cost_rates_warehouse_id_cost_name_effective_date_key"
UNIQUE ("warehouse_id", "cost_name", "effective_date");

CREATE INDEX IF NOT EXISTS "cost_rates_warehouse_id_cost_name_effective_date_idx"
ON "cost_rates" ("warehouse_id", "cost_name", "effective_date");
