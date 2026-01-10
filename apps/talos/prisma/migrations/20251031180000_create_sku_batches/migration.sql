CREATE TABLE "sku_batches" (
  "id" TEXT NOT NULL,
  "sku_id" TEXT NOT NULL,
  "batch_code" TEXT NOT NULL,
  "description" TEXT,
  "production_date" TIMESTAMP(3),
  "expiry_date" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sku_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sku_batches_sku_id_batch_code_key"
  ON "sku_batches" ("sku_id", "batch_code");

ALTER TABLE "sku_batches"
  ADD CONSTRAINT "sku_batches_sku_id_fkey"
  FOREIGN KEY ("sku_id") REFERENCES "skus"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
