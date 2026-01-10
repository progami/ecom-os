-- Add EXPORT action to AuditAction enum for audited exports.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'AuditAction'
      AND e.enumlabel = 'EXPORT'
  ) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'EXPORT';
  END IF;
END $$;

