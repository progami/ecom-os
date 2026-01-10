-- Backfill for semantic change: ISSUED now means supplier accepted (signed PI present).
-- Older data used ISSUED as "sent to supplier"; move those back to DRAFT if no PI exists.
UPDATE "purchase_orders" AS po
SET "status" = 'DRAFT'
WHERE po."status" = 'ISSUED'
  AND po."proforma_invoice_number" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "purchase_order_documents" AS doc
    WHERE doc."purchase_order_id" = po."id"
      AND doc."stage" = 'ISSUED'
      AND doc."document_type" = 'proforma_invoice'
  );

