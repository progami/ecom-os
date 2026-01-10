DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'cost_ledger'
      AND column_name = 'cost_name'
  ) THEN
    ALTER TABLE "cost_ledger" ADD COLUMN "cost_name" TEXT;
  END IF;
END $$;

UPDATE "cost_ledger"
SET "cost_name" = COALESCE("cost_name", 'Manual Cost');

ALTER TABLE "cost_ledger"
ALTER COLUMN "cost_name" SET NOT NULL;
