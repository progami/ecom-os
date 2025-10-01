ALTER TABLE "cross_plan"."PurchaseOrderPayment"
  ADD COLUMN "amountExpected" DECIMAL(12, 2),
  ADD COLUMN "amountPaid" DECIMAL(12, 2);

UPDATE "cross_plan"."PurchaseOrderPayment"
SET "amountExpected" = "amount"
WHERE "amountExpected" IS NULL;

ALTER TABLE "cross_plan"."PurchaseOrderPayment"
  DROP COLUMN "amount",
  DROP COLUMN "status";
