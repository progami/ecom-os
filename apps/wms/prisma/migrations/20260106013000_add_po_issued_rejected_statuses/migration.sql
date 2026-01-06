-- Add explicit PO issuance + supplier rejection statuses
-- This differentiates buyer-cancelled orders (CANCELLED) from supplier-declined (REJECTED),
-- and introduces ISSUED as the point where a draft PO is sent to the supplier.

ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'ISSUED';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

