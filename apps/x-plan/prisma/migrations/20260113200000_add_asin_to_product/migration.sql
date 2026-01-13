-- AlterTable
ALTER TABLE "Product" ADD COLUMN "asin" TEXT;

-- CreateIndex
CREATE INDEX "Product_asin_idx" ON "Product"("asin");
