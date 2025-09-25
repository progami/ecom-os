DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'PurchaseOrderStatus'
      AND e.enumlabel = 'REVIEW'
  ) THEN
    ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'REVIEW';
  END IF;
END$$;
