-- Purchase Order Documents
-- Adds purchase_order_documents table for stage-backed document uploads.

-- CreateEnum
CREATE TYPE "public"."PurchaseOrderDocumentStage" AS ENUM (
  'MANUFACTURING',
  'OCEAN',
  'WAREHOUSE',
  'SHIPPED'
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."purchase_order_documents" (
  "id" TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "stage" "public"."PurchaseOrderDocumentStage" NOT NULL,
  "document_type" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "s3_key" TEXT NOT NULL,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploaded_by_id" TEXT,
  "uploaded_by_name" TEXT,
  "metadata" JSONB,
  CONSTRAINT "purchase_order_documents_pkey" PRIMARY KEY ("id")
);

-- ForeignKey
ALTER TABLE "public"."purchase_order_documents"
  DROP CONSTRAINT IF EXISTS "purchase_order_documents_purchase_order_id_fkey";
ALTER TABLE "public"."purchase_order_documents"
  ADD CONSTRAINT "purchase_order_documents_purchase_order_id_fkey"
  FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_order_documents_purchase_order_id_stage_document_type_key"
  ON "public"."purchase_order_documents" ("purchase_order_id", "stage", "document_type");

CREATE INDEX IF NOT EXISTS "purchase_order_documents_purchase_order_id_idx"
  ON "public"."purchase_order_documents" ("purchase_order_id");

CREATE INDEX IF NOT EXISTS "purchase_order_documents_stage_idx"
  ON "public"."purchase_order_documents" ("stage");

CREATE INDEX IF NOT EXISTS "purchase_order_documents_document_type_idx"
  ON "public"."purchase_order_documents" ("document_type");

