-- Align X-Plan purchase order statuses with Talos workflow statuses.

ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'ISSUED';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'MANUFACTURING';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'OCEAN';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'WAREHOUSE';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'SHIPPED';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- Backfill legacy statuses to Talos-aligned values.
UPDATE "PurchaseOrder"
SET "status" = 'ISSUED'
WHERE "status" = 'PLANNED';

UPDATE "PurchaseOrder"
SET "status" = 'MANUFACTURING'
WHERE "status" = 'PRODUCTION';

UPDATE "PurchaseOrder"
SET "status" = 'OCEAN'
WHERE "status" = 'IN_TRANSIT';

UPDATE "PurchaseOrder"
SET "status" = 'WAREHOUSE'
WHERE "status" = 'ARRIVED';

UPDATE "PurchaseOrder"
SET "status" = 'ARCHIVED'
WHERE "status" = 'CLOSED';

ALTER TABLE "PurchaseOrder"
ALTER COLUMN "status"
SET DEFAULT 'ISSUED';
