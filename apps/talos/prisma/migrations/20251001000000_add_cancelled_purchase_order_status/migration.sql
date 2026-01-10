DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'PurchaseOrderStatus'
      AND e.enumlabel = 'CANCELLED'
  ) THEN
    ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'CANCELLED';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'PurchaseOrderLineStatus'
      AND e.enumlabel = 'CANCELLED'
  ) THEN
    ALTER TYPE "PurchaseOrderLineStatus" ADD VALUE 'CANCELLED';
  END IF;
END$$;
