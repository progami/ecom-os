-- Migration script to merge RecurringExpense data into Expense table
-- This should be run before generating the Prisma migration

-- Step 1: Insert RecurringExpense data into Expense table
INSERT INTO "Expense" (
  id,
  date,
  "weekStarting",
  "weekEnding",
  category,
  description,
  amount,
  type,
  "isRecurring",
  "isActual",
  "isCOGS",
  metadata,
  "createdAt",
  "updatedAt"
)
SELECT 
  gen_random_uuid()::text,
  "weekStarting" as date,
  "weekStarting",
  "weekEnding",
  category,
  category || ' - Recurring' as description,
  amount,
  'recurring' as type,
  true as "isRecurring",
  false as "isActual",
  false as "isCOGS",
  metadata,
  "createdAt",
  "updatedAt"
FROM "RecurringExpense"
ON CONFLICT ("weekStarting", category) DO UPDATE
SET 
  amount = EXCLUDED.amount,
  "weekEnding" = EXCLUDED."weekEnding",
  metadata = EXCLUDED.metadata,
  "updatedAt" = EXCLUDED."updatedAt";

-- Step 2: The RecurringExpense table will be dropped by Prisma migration