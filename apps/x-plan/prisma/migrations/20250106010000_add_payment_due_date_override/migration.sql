-- CreateEnum
CREATE TYPE "PaymentDueDateSource" AS ENUM ('SYSTEM', 'USER');

-- AlterTable
ALTER TABLE "cross_plan"."PurchaseOrderPayment"
  ADD COLUMN "dueDateDefault" TIMESTAMP(3),
  ADD COLUMN "dueDateSource" "PaymentDueDateSource" NOT NULL DEFAULT 'SYSTEM';

UPDATE "cross_plan"."PurchaseOrderPayment"
SET "dueDateDefault" = "dueDate", "dueDateSource" = 'SYSTEM'
WHERE "dueDateDefault" IS NULL;
