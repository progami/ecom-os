-- PO State Machine & RBAC Migration
-- This migration transforms the 6-status workflow to 5-stage state machine
-- and adds granular RBAC permissions

-- Step 1: Create Permission table
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create UserPermission table
CREATE TABLE "user_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "granted_by_id" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- Step 3: Add indexes and constraints for permission tables
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");
CREATE INDEX "permissions_category_idx" ON "permissions"("category");
CREATE UNIQUE INDEX "user_permissions_userId_permissionId_key" ON "user_permissions"("user_id", "permission_id");
CREATE INDEX "user_permissions_user_id_idx" ON "user_permissions"("user_id");
CREATE INDEX "user_permissions_permission_id_idx" ON "user_permissions"("permission_id");

-- Step 4: Add foreign keys for UserPermission
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Add new columns to purchase_orders
ALTER TABLE "purchase_orders" ADD COLUMN "po_number" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "is_legacy" BOOLEAN NOT NULL DEFAULT false;

-- Manufacturing Stage Fields
ALTER TABLE "purchase_orders" ADD COLUMN "proforma_invoice_id" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "proforma_invoice_data" JSONB;
ALTER TABLE "purchase_orders" ADD COLUMN "manufacturing_start" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN "manufacturing_end" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN "cargo_details" JSONB;

-- Ocean Stage Fields
ALTER TABLE "purchase_orders" ADD COLUMN "house_bill_of_lading" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "packing_list_ref" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "commercial_invoice_id" TEXT;

-- Warehouse Stage Fields
ALTER TABLE "purchase_orders" ADD COLUMN "warehouse_invoice_id" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "surrender_bl" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "transaction_certificate" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "customs_declaration" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "proof_of_delivery" TEXT;

-- Stage Approval Tracking
ALTER TABLE "purchase_orders" ADD COLUMN "draft_approved_at" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN "draft_approved_by_id" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "draft_approved_by_name" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "manufacturing_approved_at" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN "manufacturing_approved_by_id" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "manufacturing_approved_by_name" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "ocean_approved_at" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN "ocean_approved_by_id" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "ocean_approved_by_name" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "warehouse_approved_at" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN "warehouse_approved_by_id" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "warehouse_approved_by_name" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "shipped_at" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN "shipped_by_id" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "shipped_by_name" TEXT;

-- Step 6: Add unique constraint on po_number
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");

-- Step 7: Add index on is_legacy
CREATE INDEX "purchase_orders_is_legacy_idx" ON "purchase_orders"("is_legacy");

-- Step 8: Update PurchaseOrderStatus enum
-- First, add new values to the enum
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'MANUFACTURING';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'OCEAN';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'WAREHOUSE';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'SHIPPED';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- Step 9: Archive all existing purchase orders and transform statuses
-- Mark all existing POs as legacy
UPDATE "purchase_orders" SET "is_legacy" = true;

-- Transform old statuses to ARCHIVED
UPDATE "purchase_orders"
SET "status" = 'ARCHIVED'
WHERE "status" IN ('AWAITING_PROOF', 'REVIEW', 'POSTED', 'CLOSED');

-- Note: DRAFT and CANCELLED can stay as-is, but we mark them as legacy
-- The enum values AWAITING_PROOF, REVIEW, POSTED, CLOSED will remain in the enum
-- but won't be used for new orders (Prisma schema won't include them)

-- Step 10: Seed default permissions
INSERT INTO "permissions" ("code", "name", "description", "category") VALUES
    ('po.create', 'Create Purchase Order', 'Permission to create new purchase orders', 'purchase_order'),
    ('po.edit', 'Edit Purchase Order', 'Permission to edit purchase order details', 'purchase_order'),
    ('po.cancel', 'Cancel Purchase Order', 'Permission to cancel purchase orders', 'purchase_order'),
    ('po.approve.draft_to_manufacturing', 'Approve Draft to Manufacturing', 'Permission to approve PO transition from Draft to Manufacturing stage', 'purchase_order'),
    ('po.approve.manufacturing_to_ocean', 'Approve Manufacturing to Ocean', 'Permission to approve PO transition from Manufacturing to Ocean stage', 'purchase_order'),
    ('po.approve.ocean_to_warehouse', 'Approve Ocean to Warehouse', 'Permission to approve PO transition from Ocean to Warehouse stage', 'purchase_order'),
    ('po.approve.warehouse_to_shipped', 'Approve Warehouse to Shipped', 'Permission to approve PO transition from Warehouse to Shipped stage', 'purchase_order'),
    ('user.manage', 'Manage Users', 'Permission to create, edit, and manage users', 'user_management'),
    ('permission.manage', 'Manage Permissions', 'Permission to grant and revoke user permissions', 'user_management')
ON CONFLICT ("code") DO NOTHING;

-- Note: We cannot remove enum values in PostgreSQL easily, so the old values
-- (AWAITING_PROOF, REVIEW, POSTED, CLOSED, FULFILLMENT) will remain in the DB enum
-- but won't be used by the application. The Prisma schema defines the valid values.
