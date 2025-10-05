-- Update PurchaseOrderStatus enum to new lifecycle values
CREATE TYPE "PurchaseOrderStatus_new" AS ENUM ('DRAFT','SHIPPED','WAREHOUSE','CANCELLED','CLOSED');

ALTER TABLE "purchase_orders"
  ALTER COLUMN "status" TYPE "PurchaseOrderStatus_new"
  USING CASE "status"
    WHEN 'DRAFT' THEN 'DRAFT'::"PurchaseOrderStatus_new"
    WHEN 'AWAITING_PROOF' THEN 'SHIPPED'::"PurchaseOrderStatus_new"
    WHEN 'REVIEW' THEN 'WAREHOUSE'::"PurchaseOrderStatus_new"
    WHEN 'POSTED' THEN 'WAREHOUSE'::"PurchaseOrderStatus_new"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"PurchaseOrderStatus_new"
    WHEN 'CLOSED' THEN 'CLOSED'::"PurchaseOrderStatus_new"
    ELSE 'DRAFT'::"PurchaseOrderStatus_new"
  END;

ALTER TYPE "PurchaseOrderStatus" RENAME TO "PurchaseOrderStatus_old";
ALTER TYPE "PurchaseOrderStatus_new" RENAME TO "PurchaseOrderStatus";
DROP TYPE "PurchaseOrderStatus_old";
