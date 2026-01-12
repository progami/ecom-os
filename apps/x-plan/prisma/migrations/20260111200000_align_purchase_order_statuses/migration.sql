-- Align X-Plan purchase order statuses with Talos workflow statuses.

ALTER TYPE "cross_plan"."PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "cross_plan"."PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'ISSUED';
ALTER TYPE "cross_plan"."PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'MANUFACTURING';
ALTER TYPE "cross_plan"."PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'OCEAN';
ALTER TYPE "cross_plan"."PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'WAREHOUSE';
ALTER TYPE "cross_plan"."PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'SHIPPED';
ALTER TYPE "cross_plan"."PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "cross_plan"."PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- Backfill legacy statuses to Talos-aligned values.
UPDATE "cross_plan"."PurchaseOrder"
SET "status" = 'ISSUED'
WHERE "status" = 'PLANNED';

UPDATE "cross_plan"."PurchaseOrder"
SET "status" = 'MANUFACTURING'
WHERE "status" = 'PRODUCTION';

UPDATE "cross_plan"."PurchaseOrder"
SET "status" = 'OCEAN'
WHERE "status" = 'IN_TRANSIT';

UPDATE "cross_plan"."PurchaseOrder"
SET "status" = 'WAREHOUSE'
WHERE "status" = 'ARRIVED';

UPDATE "cross_plan"."PurchaseOrder"
SET "status" = 'ARCHIVED'
WHERE "status" = 'CLOSED';

ALTER TABLE "cross_plan"."PurchaseOrder"
ALTER COLUMN "status"
SET DEFAULT 'ISSUED';

