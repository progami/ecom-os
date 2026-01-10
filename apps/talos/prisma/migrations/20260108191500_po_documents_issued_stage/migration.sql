-- Allow attaching supplier-accepted PI documents at the ISSUED stage.
ALTER TYPE "PurchaseOrderDocumentStage" ADD VALUE IF NOT EXISTS 'ISSUED';

-- Migrate existing Proforma Invoice uploads from MANUFACTURING to ISSUED.
UPDATE "purchase_order_documents"
SET "stage" = 'ISSUED'
WHERE "stage" = 'MANUFACTURING'
  AND "document_type" = 'proforma_invoice';

