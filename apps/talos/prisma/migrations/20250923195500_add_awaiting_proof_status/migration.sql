DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'PurchaseOrderStatus'
      AND e.enumlabel = 'AWAITING_PROOF'
  ) THEN
    ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'AWAITING_PROOF';
  END IF;
END$$;
