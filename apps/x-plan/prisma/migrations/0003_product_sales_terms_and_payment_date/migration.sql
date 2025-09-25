CREATE TABLE IF NOT EXISTS "x_plan"."ProductSalesTerm" (
  "id" TEXT PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "sellingPrice" DECIMAL(10,2) NOT NULL,
  "tacosPercent" DECIMAL(5,4) NOT NULL,
  "fbaFee" DECIMAL(10,2) NOT NULL,
  "referralRate" DECIMAL(5,4) NOT NULL,
  "storagePerMonth" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductSalesTerm_product_fkey" FOREIGN KEY ("productId") REFERENCES "x_plan"."Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ProductSalesTerm_product_dates_idx" ON "x_plan"."ProductSalesTerm" ("productId", "startDate", "endDate");

ALTER TABLE "x_plan"."PurchaseOrderPayment" RENAME COLUMN "dueDate" TO "paymentDate";
