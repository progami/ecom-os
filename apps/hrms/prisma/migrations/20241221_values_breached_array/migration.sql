-- Migration: Convert primaryValueBreached (single) to valuesBreached (array)
-- This preserves existing data by converting single values to single-element arrays

-- Step 1: Add new valuesBreached column as array with empty default
ALTER TABLE "hrms"."DisciplinaryAction"
ADD COLUMN "valuesBreached" "hrms"."ValueBreach"[] NOT NULL DEFAULT '{}';

-- Step 2: Migrate existing data - convert single value to array
UPDATE "hrms"."DisciplinaryAction"
SET "valuesBreached" = ARRAY["primaryValueBreached"]::"hrms"."ValueBreach"[]
WHERE "primaryValueBreached" IS NOT NULL;

-- Step 3: Drop the old column
ALTER TABLE "hrms"."DisciplinaryAction"
DROP COLUMN "primaryValueBreached";

-- Step 4: Drop old index if exists
DROP INDEX IF EXISTS "hrms"."DisciplinaryAction_primaryValueBreached_idx";

-- Step 5: Create new index on array column
CREATE INDEX "DisciplinaryAction_valuesBreached_idx"
ON "hrms"."DisciplinaryAction" USING GIN ("valuesBreached");
