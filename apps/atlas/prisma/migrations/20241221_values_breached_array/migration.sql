-- Migration: Convert primaryValueBreached (single) to valuesBreached (array)
-- This preserves existing data by converting single values to single-element arrays

-- Step 1: Add new valuesBreached column as array with empty default
ALTER TABLE "atlas"."DisciplinaryAction"
ADD COLUMN "valuesBreached" "atlas"."ValueBreach"[] NOT NULL DEFAULT '{}';

-- Step 2: Migrate existing data - convert single value to array
UPDATE "atlas"."DisciplinaryAction"
SET "valuesBreached" = ARRAY["primaryValueBreached"]::"atlas"."ValueBreach"[]
WHERE "primaryValueBreached" IS NOT NULL;

-- Step 3: Drop the old column
ALTER TABLE "atlas"."DisciplinaryAction"
DROP COLUMN "primaryValueBreached";

-- Step 4: Drop old index if exists
DROP INDEX IF EXISTS "atlas"."DisciplinaryAction_primaryValueBreached_idx";

-- Step 5: Create new index on array column
CREATE INDEX "DisciplinaryAction_valuesBreached_idx"
ON "atlas"."DisciplinaryAction" USING GIN ("valuesBreached");
