-- Link SKUs to default/secondary suppliers

ALTER TABLE "public"."skus"
  ADD COLUMN IF NOT EXISTS "default_supplier_id" TEXT,
  ADD COLUMN IF NOT EXISTS "secondary_supplier_id" TEXT;

ALTER TABLE "public"."skus"
  DROP CONSTRAINT IF EXISTS "skus_default_supplier_id_fkey";
ALTER TABLE "public"."skus"
  ADD CONSTRAINT "skus_default_supplier_id_fkey"
  FOREIGN KEY ("default_supplier_id")
  REFERENCES "public"."suppliers"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "public"."skus"
  DROP CONSTRAINT IF EXISTS "skus_secondary_supplier_id_fkey";
ALTER TABLE "public"."skus"
  ADD CONSTRAINT "skus_secondary_supplier_id_fkey"
  FOREIGN KEY ("secondary_supplier_id")
  REFERENCES "public"."suppliers"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "public"."skus"
  DROP CONSTRAINT IF EXISTS "skus_supplier_ids_distinct_check";
ALTER TABLE "public"."skus"
  ADD CONSTRAINT "skus_supplier_ids_distinct_check"
  CHECK (
    "default_supplier_id" IS NULL
    OR "secondary_supplier_id" IS NULL
    OR "default_supplier_id" <> "secondary_supplier_id"
  );

CREATE INDEX IF NOT EXISTS "skus_default_supplier_id_idx"
  ON "public"."skus" ("default_supplier_id");

CREATE INDEX IF NOT EXISTS "skus_secondary_supplier_id_idx"
  ON "public"."skus" ("secondary_supplier_id");

